import { randomInt } from "node:crypto";
import { CognitoIdentityProviderClient, InitiateAuthCommand, RespondToAuthChallengeCommand } from "@aws-sdk/client-cognito-identity-provider";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { APIGatewayProxyHandlerV2, CreateAuthChallengeTriggerHandler, DefineAuthChallengeTriggerHandler, VerifyAuthChallengeResponseTriggerHandler } from "aws-lambda";
import { z } from "zod";
import { config } from "../config.js";
import { badRequest, unauthorized } from "../lib/errors.js";
import { errorResponse, json, method, parseJsonBody, routePath } from "../lib/http.js";

const cognito = new CognitoIdentityProviderClient({ region: config.region });
const sns = new SNSClient({ region: config.region });
const PhoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, "Use an E.164 phone number, for example +919876543210");
const StartSchema = z.object({ phoneNumber: PhoneSchema });
const VerifySchema = z.object({ phoneNumber: PhoneSchema, session: z.string().min(1), code: z.string().regex(/^\d{6}$/, "The OTP must contain 6 digits") });

/**
 * Starts Cognito CUSTOM_AUTH for the mobile app. The user must already exist
 * in the pool with phone_number set and the mobile app client must allow
 * CUSTOM_AUTH. The custom challenge trigger sends the SMS.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (method(event) === "OPTIONS") return json(204, null, event);
    const path = routePath(event);
    if (method(event) !== "POST") throw badRequest("Only POST is supported for OTP routes");
    const body = parseJsonBody<Record<string, unknown>>(event);
    if (path === "/auth/otp/send") return startOtp(StartSchema.parse(body), event);
    if (path === "/auth/otp/verify") return verifyOtp(VerifySchema.parse(body), event);
    throw badRequest("Auth route not found");
  } catch (error) {
    return errorResponse(normalizeAuthError(error), event);
  }
};

async function startOtp(input: z.infer<typeof StartSchema>, event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  if (!config.cognitoMobileClientId) throw badRequest("COGNITO_MOBILE_CLIENT_ID is not configured");
  const result = await cognito.send(new InitiateAuthCommand({
    AuthFlow: "CUSTOM_AUTH",
    ClientId: config.cognitoMobileClientId,
    AuthParameters: { USERNAME: input.phoneNumber },
  }));
  if (!result.Session) throw badRequest("Cognito did not return an authentication session");
  return json(200, { session: result.Session, challengeName: result.ChallengeName ?? "CUSTOM_CHALLENGE", delivery: "sms" }, event);
}

async function verifyOtp(input: z.infer<typeof VerifySchema>, event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  if (!config.cognitoMobileClientId) throw badRequest("COGNITO_MOBILE_CLIENT_ID is not configured");
  const result = await cognito.send(new RespondToAuthChallengeCommand({
    ClientId: config.cognitoMobileClientId,
    ChallengeName: "CUSTOM_CHALLENGE",
    Session: input.session,
    ChallengeResponses: { USERNAME: input.phoneNumber, ANSWER: input.code },
  }));
  if (!result.AuthenticationResult) throw unauthorized("The OTP is invalid or has expired");
  return json(200, {
    accessToken: result.AuthenticationResult.AccessToken,
    idToken: result.AuthenticationResult.IdToken,
    refreshToken: result.AuthenticationResult.RefreshToken,
    expiresIn: result.AuthenticationResult.ExpiresIn,
  }, event);
}

function normalizeAuthError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "UserNotFoundException") return badRequest("No Cognito user is registered with this phone number");
  if (name === "NotAuthorizedException") return unauthorized("The OTP session is invalid or expired");
  if (name === "ResourceNotFoundException") return badRequest("The Cognito user pool or mobile client configuration is invalid");
  if (name === "InvalidParameterException" || name === "InvalidLambdaResponseException") {
    return badRequest("Cognito custom authentication is not configured correctly");
  }
  return error;
}

export const defineAuthChallenge: DefineAuthChallengeTriggerHandler = async (event) => {
  const session = event.request.session ?? [];
  const successfulCustomChallenges = session.filter((challenge) => challenge.challengeName === "CUSTOM_CHALLENGE" && challenge.challengeResult).length;
  const failedCustomChallenges = session.filter((challenge) => challenge.challengeName === "CUSTOM_CHALLENGE" && !challenge.challengeResult).length;
  event.response.issueTokens = successfulCustomChallenges >= 1;
  event.response.failAuthentication = failedCustomChallenges >= 3;
  if (!event.response.issueTokens && !event.response.failAuthentication) event.response.challengeName = "CUSTOM_CHALLENGE";
  return event;
};

export const createAuthChallenge: CreateAuthChallengeTriggerHandler = async (event) => {
  if (event.request.challengeName !== "CUSTOM_CHALLENGE") return event;
  const phoneNumber = event.request.userAttributes.phone_number;
  if (!phoneNumber) throw new Error("The Cognito user does not have phone_number");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await sns.send(new PublishCommand({
    PhoneNumber: phoneNumber,
    Message: `StaffFlow verification code: ${code}. It expires shortly.`,
  }));
  event.response.privateChallengeParameters = { answer: code };
  event.response.publicChallengeParameters = { delivery: "sms", phoneNumber: maskPhone(phoneNumber) };
  event.response.challengeMetadata = "CUSTOM_CHALLENGE";
  return event;
};

export const verifyAuthChallenge: VerifyAuthChallengeResponseTriggerHandler = async (event) => {
  event.response.answerCorrect = Boolean(event.request.challengeAnswer && event.request.challengeAnswer === event.request.privateChallengeParameters.answer);
  return event;
};

function maskPhone(phoneNumber: string) {
  return phoneNumber.length < 6 ? "***" : `${phoneNumber.slice(0, 3)}${"*".repeat(Math.max(2, phoneNumber.length - 5))}${phoneNumber.slice(-2)}`;
}
