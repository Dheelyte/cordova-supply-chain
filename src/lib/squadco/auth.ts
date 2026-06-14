import { request } from "./client";
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RequestOtpRequest,
  RequestOtpResponse,
  UpdateProfileRequest,
} from "./types";

export function requestOtp(input: RequestOtpRequest): Promise<RequestOtpResponse> {
  return request<RequestOtpResponse>("/auth/request-otp", {
    method: "POST",
    body: input,
    // `work_email_verification` purpose requires auth; default `registration`
    // does not. We always send unauthenticated for the registration flow.
    unauthenticated: input.purpose !== "work_email_verification",
  });
}

export function register(input: RegisterRequest): Promise<RegisterResponse> {
  return request<RegisterResponse>("/auth/register", {
    method: "POST",
    body: input,
    unauthenticated: true,
  });
}

export function login(input: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: input,
    unauthenticated: true,
  });
}

export function updateProfile(
  input: UpdateProfileRequest
): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/profile", {
    method: "PATCH",
    body: input,
  });
}

export function verifyWorkEmail(otp: string): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/verify-work-email", {
    method: "POST",
    body: { otp },
  });
}
