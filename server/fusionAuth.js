// @flow
import { FusionAuthClient } from "@fusionauth/typescript-client";

const authHost = process.env.FUSION_AUTH_HOST;
const clientId = process.env.FUSION_AUTH_CLIENT_ID;
const clientSecret = process.env.FUSION_AUTH_CLIENT_SECRET;
const redirectUri = `${process.env.URL}/auth/fusionauth.callback`;
const apiKey = process.env.FUSION_AUTH_API_KEY;
const applicationId = process.env.FUSION_AUTH_APPLICATION_ID;

export const tenantId = process.env.FUSION_AUTH_TENANT_ID;
export const teamName = process.env.FUSION_AUTH_TEAM;
export const teamImageUrl = process.env.FUSION_AUTH_IMAGE_URL;
export const hookSecret = process.env.FUSION_AUTH_HOOK_SECRET;

export const client = new FusionAuthClient(
  apiKey,
  `https://${authHost}`,
  tenantId
);

export function generateAuthorizeUrl(
  state: string,
  scopes: string[] = ["offline_access"]
): string {
  const baseUrl = `https://${authHost}/oauth2/authorize`;
  const params = {
    client_id: clientId,
    scope: scopes ? scopes.join(" ") : "",
    redirect_uri: redirectUri,
    state,
    response_type: "code",
  };

  const urlParams = Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");

  return `${baseUrl}?${urlParams}`;
}

export function exchangeOAuthCodeForAccessToken(code: string) {
  return client.exchangeOAuthCodeForAccessToken(
    code,
    clientId,
    clientSecret,
    redirectUri
  );
}

export function retrieveUser(userId: string) {
  return client.retrieveUser(userId);
}

export function registerUser(userId: string) {
  return client.register(userId, {
    registration: { applicationId, verified: true },
  });
}
