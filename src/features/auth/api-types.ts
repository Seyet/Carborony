export type AuthRedirectData = {
  redirectTo: string
}

export type ForgotPasswordData = {
  accepted: true
}

export type RegistrationData = {
  email: string
  redirectTo: string
}

export type ResendSignupOtpData = {
  accepted: true
}
