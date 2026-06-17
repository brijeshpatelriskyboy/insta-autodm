import { env } from "../config/env";
import { getMetaRedirectUri, META_GRAPH_API_VERSION } from "../config/meta";
import { AppError } from "../utils/errors";

type MetaGraphError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

type TokenExchangeResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type FacebookProfile = {
  id: string;
  name?: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
};

async function parseMetaResponse<T>(response: Response, context: string): Promise<T> {
  const body = (await response.json()) as T & MetaGraphError;

  if (!response.ok || body.error) {
    const message = body.error?.message ?? `Meta API request failed (${context})`;
    console.error(`[meta-oauth] ${context} failed:`, {
      status: response.status,
      type: body.error?.type ?? "unknown",
      code: body.error?.code ?? null,
      message,
    });
    throw new AppError(502, message);
  }

  return body;
}

export const metaGraphService = {
  async exchangeCodeForToken(code: string): Promise<TokenExchangeResponse> {
    const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token`);
    url.searchParams.set("client_id", env.META_APP_ID!.trim());
    url.searchParams.set("client_secret", env.META_APP_SECRET!.trim());
    url.searchParams.set("redirect_uri", getMetaRedirectUri());
    url.searchParams.set("code", code);

    console.log("[meta-oauth] token exchange started");

    const response = await fetch(url.toString(), { method: "GET" });
    const data = await parseMetaResponse<TokenExchangeResponse>(response, "token exchange");

    console.log("[meta-oauth] token exchange succeeded:", {
      tokenType: data.token_type ?? "unknown",
      expiresIn: data.expires_in ?? null,
      accessTokenReceived: Boolean(data.access_token),
    });

    return data;
  },

  async fetchFacebookProfile(accessToken: string): Promise<FacebookProfile> {
    const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/me`);
    url.searchParams.set("fields", "id,name,picture.type(large)");
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url.toString(), { method: "GET" });
    const profile = await parseMetaResponse<FacebookProfile>(response, "profile fetch");

    console.log("[meta-oauth] profile fetched:", {
      facebookUserId: profile.id,
      hasName: Boolean(profile.name),
      hasPicture: Boolean(profile.picture?.data?.url),
    });

    return profile;
  },
};
