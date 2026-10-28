import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
  UpdateUserPoolCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  AddPermissionCommand,
  GetFunctionCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const region = process.env.MY_AWS_REGION?.trim() || "ap-south-1";
const stage = process.env.STAGE?.trim() || "prod";
const userPoolId = required("COGNITO_USER_POOL_ID");
const service = process.env.SERVICE_NAME?.trim() || "staffflow-backend";
const functionPrefix = process.env.COGNITO_TRIGGER_FUNCTION_PREFIX?.trim() || `${service}-${stage}`;
const userPoolArn = `arn:aws:cognito-idp:${region}:${required("MY_AWS_ACCOUNT_ID")}:userpool/${userPoolId}`;

const cognito = new CognitoIdentityProviderClient({ region });
const lambda = new LambdaClient({ region });
const triggerFunctions = {
  DefineAuthChallenge: `${functionPrefix}-defineAuthChallenge`,
  CreateAuthChallenge: `${functionPrefix}-createAuthChallenge`,
  VerifyAuthChallengeResponse: `${functionPrefix}-verifyAuthChallenge`,
};

const functionArns = {};
for (const [trigger, functionName] of Object.entries(triggerFunctions)) {
  const result = await lambda.send(new GetFunctionCommand({ FunctionName: functionName }));
  const arn = result.Configuration?.FunctionArn;
  if (!arn) throw new Error(`Could not find deployed Lambda ${functionName}`);
  functionArns[trigger] = arn;

  const statementId = `staffflow-${userPoolId.replace(/[^A-Za-z0-9_-]/g, "-")}-${trigger}`;
  try {
    await lambda.send(new AddPermissionCommand({
      FunctionName: arn,
      StatementId: statementId,
      Action: "lambda:InvokeFunction",
      Principal: "cognito-idp.amazonaws.com",
      SourceArn: userPoolArn,
    }));
  } catch (error) {
    if (error?.name !== "ResourceConflictException") throw error;
  }
}

const current = (await cognito.send(new DescribeUserPoolCommand({ UserPoolId: userPoolId }))).UserPool;
if (!current) throw new Error(`Could not describe Cognito user pool ${userPoolId}`);

// UpdateUserPool is a full update operation. Preserve the existing settings and
// change only the three custom-auth trigger ARNs.
await cognito.send(new UpdateUserPoolCommand({
  UserPoolId: userPoolId,
  Policies: current.Policies,
  DeletionProtection: current.DeletionProtection,
  LambdaConfig: { ...(current.LambdaConfig ?? {}), ...functionArns },
  AutoVerifiedAttributes: current.AutoVerifiedAttributes,
  SmsVerificationMessage: current.SmsVerificationMessage,
  EmailVerificationMessage: current.EmailVerificationMessage,
  EmailVerificationSubject: current.EmailVerificationSubject,
  VerificationMessageTemplate: current.VerificationMessageTemplate,
  SmsAuthenticationMessage: current.SmsAuthenticationMessage,
  UserAttributeUpdateSettings: current.UserAttributeUpdateSettings,
  MfaConfiguration: current.MfaConfiguration,
  DeviceConfiguration: current.DeviceConfiguration,
  EmailConfiguration: current.EmailConfiguration,
  SmsConfiguration: current.SmsConfiguration,
  UserPoolTags: current.UserPoolTags,
  AdminCreateUserConfig: current.AdminCreateUserConfig,
  UserPoolAddOns: current.UserPoolAddOns,
  AccountRecoverySetting: current.AccountRecoverySetting,
  PoolName: current.Name,
  UserPoolTier: current.UserPoolTier,
  KeyConfiguration: current.KeyConfiguration,
  IssuerConfiguration: current.IssuerConfiguration,
  AcrConfiguration: current.AcrConfiguration,
}));

console.log(`Attached custom-auth triggers to ${userPoolId}`);
