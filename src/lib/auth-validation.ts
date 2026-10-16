import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s-]{5,19}$/, "Please enter a valid phone number");

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Please enter your full name").max(100, "Full name must be under 100 characters"),
    companyName: z.string().trim().min(1, "Please enter your company name").max(120, "Company name must be under 120 characters"),
    email: z.string().trim().email("Please enter a valid email").max(255, "Email must be under 255 characters"),
    phone: phoneSchema,
    password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
    terms: z.boolean().refine((value) => value, "Please accept the terms"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(1, "Please enter your password").max(72),
  remember: z.boolean(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterForm = z.infer<typeof registerSchema>;
export type LoginForm = z.infer<typeof loginSchema>;
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
