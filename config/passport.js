/* eslint-disable prefer-arrow-callback */
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const User = require("../models/User");

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ["profile", "email"], // إضافة الـ scope هنا كمان
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google Profile:", profile);

        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          return done(null, user);
        }

        // البحث بالإيميل إذا المستخدم موجود
        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          user.googleId = profile.id;
          user.emailVerified = true;
          await user.save();
          return done(null, user);
        }

        // إنشاء مستخدم جديد
        const newUser = await User.create({
          googleId: profile.id,
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          email: profile.emails[0].value,
          emailVerified: true,
          avatar:
            profile.photos && profile.photos[0]
              ? profile.photos[0].value
              : null,
          authProvider: "google",
        });

        const savedUser = await newUser.save({ validateBeforeSave: false });
        done(null, savedUser);
      } catch (error) {
        console.error("Google OAuth Error:", error);
        done(error, null);
      }
    }
  )
);
// JWT Strategy للحماية
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    },
    async (payload, done) => {
      try {
        const user = await User.findById(payload.userId);
        if (user) {
          return done(null, user);
        }
        return done(null, false);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

module.exports = passport;
