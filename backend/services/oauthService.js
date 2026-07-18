/**
 * FoodBridge - OAuth Modular Service Layer
 * Google, Facebook, Apple OAuth strategies
 */

const axios = require("axios");

class OAuthProvider {
  constructor(name, clientId, clientSecret, redirectUri) {
    this.name = name;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.isEnabled = !!(clientId && clientSecret);
  }

  async verifyToken(_token) {
    throw new Error(`Token verification not implemented for ${this.name}`);
  }

  async getUserInfo(_accessToken) {
    throw new Error(`User info not implemented for ${this.name}`);
  }
}

class GoogleOAuthStrategy extends OAuthProvider {
  constructor() {
    super(
      "google",
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI ||
        "http://localhost:5000/api/auth/google/callback",
    );
  }

  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async getToken(code) {
    const response = await axios.post("https://oauth2.googleapis.com/token", {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: this.redirectUri,
    });
    return response.data;
  }

  async getUserInfo(accessToken) {
    const response = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return {
      email: response.data.email,
      firstName: response.data.given_name || "Google",
      lastName: response.data.family_name || "User",
      avatar: response.data.picture,
      providerId: response.data.id,
    };
  }
}

class FacebookOAuthStrategy extends OAuthProvider {
  constructor() {
    super(
      "facebook",
      process.env.FACEBOOK_CLIENT_ID,
      process.env.FACEBOOK_CLIENT_SECRET,
      process.env.FACEBOOK_REDIRECT_URI ||
        "http://localhost:5000/api/auth/facebook/callback",
    );
  }

  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
      scope: "email,public_profile",
    });
    return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
  }

  async getToken(code) {
    const response = await axios.get(
      "https://graph.facebook.com/v18.0/oauth/access_token",
      {
        params: {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri,
        },
      },
    );
    return response.data;
  }

  async getUserInfo(accessToken) {
    const response = await axios.get("https://graph.facebook.com/me", {
      params: {
        fields: "id,name,email,first_name,last_name,picture",
        access_token: accessToken,
      },
    });
    return {
      email: response.data.email,
      firstName: response.data.first_name || "Facebook",
      lastName: response.data.last_name || "User",
      avatar: response.data.picture?.data?.url,
      providerId: response.data.id,
    };
  }
}

class AppleOAuthStrategy extends OAuthProvider {
  constructor() {
    super(
      "apple",
      process.env.APPLE_CLIENT_ID,
      process.env.APPLE_CLIENT_SECRET,
      process.env.APPLE_REDIRECT_URI ||
        "http://localhost:5000/api/auth/apple/callback",
    );
  }

  getAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "name email",
      state,
      response_mode: "form_post",
    });
    return `https://appleid.apple.com/auth/authorize?${params}`;
  }

  async getToken(code) {
    const response = await axios.post("https://appleid.apple.com/auth/token", {
      grant_type: "authorization_code",
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
    });
    return response.data;
  }

  async getUserInfo(idToken) {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.decode(idToken);
    return {
      email: decoded?.email || null,
      firstName: "Apple",
      lastName: "User",
      providerId: decoded?.sub,
    };
  }
}

class OAuthServiceFactory {
  constructor() {
    this.providers = {
      google: new GoogleOAuthStrategy(),
      facebook: new FacebookOAuthStrategy(),
      apple: new AppleOAuthStrategy(),
    };
  }

  getEnabledProviders() {
    const enabled = {};
    for (const [key, provider] of Object.entries(this.providers)) {
      enabled[key] = provider.isEnabled;
    }
    return enabled;
  }

  getProvider(name) {
    const provider = this.providers[name];
    if (!provider) {
      throw new Error(`OAuth provider ${name} is unknown.`);
    }
    return provider;
  }

  isProviderEnabled(name) {
    const provider = this.providers[name];
    return provider ? provider.isEnabled : false;
  }
}

module.exports = new OAuthServiceFactory();
