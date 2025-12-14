/**
 * FILE PATH: backend/config/passport.js
 * Configures Passport strategies: JWT (for API security), Google, and GitHub (for OAuth).
 */

import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../models/User.js';

// =======================================================
// 1. JWT STRATEGY (FOR API AUTHENTICATION)
// =======================================================
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_ACCESS_SECRET,
};

passport.use(
  'jwt',
  new JwtStrategy(jwtOptions, async (jwt_payload, done) => {
    try {
      const user = await User.findById(jwt_payload.userId).select('-password');
      if (user) return done(null, user);
      return done(null, false);
    } catch (error) {
      return done(error, false);
    }
  })
);

// =======================================================
// 2. GOOGLE OAUTH STRATEGY (OPTIONAL)
// =======================================================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails[0].value;
          const name = profile.displayName;
          const googleId = profile.id;

          let user = await User.findOne({ $or: [{ email }, { googleId }] });

          if (!user) {
            user = await User.create({
              name,
              email,
              googleId,
              role: 'student',
              is_verified: true,
            });
          } else if (!user.googleId) {
            user.googleId = googleId;
            await user.save();
          }

          return done(null, user);
        } catch (error) {
          console.error('❌ Google OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );
}

// =======================================================
// 3. GITHUB OAUTH STRATEGY (OPTIONAL)
// =======================================================
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || '/api/auth/github/callback',
        scope: ['user:email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || `${profile.username}@github.placeholder.com`;
          const name = profile.displayName || profile.username;
          const githubId = profile.id;

          let user = await User.findOne({ $or: [{ email }, { githubId }] });

          if (!user) {
            user = await User.create({
              name,
              email,
              githubId,
              role: 'student',
              is_verified: true,
            });
          } else if (!user.githubId) {
            user.githubId = githubId;
            await user.save();
          }

          return done(null, user);
        } catch (error) {
          console.error('❌ GitHub OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );
}

// =======================================================
// SERIALIZE & DESERIALIZE USER (FOR SESSION/OAUTH)
// =======================================================
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select('-password');
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
