export const qaEnv = () => ({
  baseUrl: process.env.BASE_URL ?? "http://127.0.0.1:3000",
  email: process.env.QA_USER_EMAIL,
  password: process.env.QA_USER_PASSWORD,
  secondEmail: process.env.QA_SECOND_USER_EMAIL
});

export const hasAuthEnvironment = () => {
  const env = qaEnv();
  return Boolean(env.email && env.password);
};

