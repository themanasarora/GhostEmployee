import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  User,
  AuthError,
} from "firebase/auth";
import { auth, googleProvider, githubProvider } from "./firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthResult {
  user: User | null;
  error: string | null;
}

// ─── Error message mapper ─────────────────────────────────────────────────────

function parseAuthError(error: AuthError): string {
  switch (error.code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/invalid-email":
      return "That email address isn't valid.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    case "auth/popup-closed-by-user":
      return "Sign-in window was closed. Try again.";
    case "auth/cancelled-popup-request":
      return "Only one sign-in window can be open at a time.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    default:
      return "Something went wrong. Please try again.";
  }
}

// ─── Email / Password ─────────────────────────────────────────────────────────

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<AuthResult> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    return { user: result.user, error: null };
  } catch (err) {
    return { user: null, error: parseAuthError(err as AuthError) };
  }
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (err) {
    return { user: null, error: parseAuthError(err as AuthError) };
  }
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

export async function loginWithGoogle(): Promise<AuthResult> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (err) {
    return { user: null, error: parseAuthError(err as AuthError) };
  }
}

export async function loginWithGithub(): Promise<AuthResult> {
  try {
    const result = await signInWithPopup(auth, githubProvider);
    return { user: result.user, error: null };
  } catch (err) {
    return { user: null, error: parseAuthError(err as AuthError) };
  }
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function resetPassword(email: string): Promise<{ error: string | null }> {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (err) {
    return { error: parseAuthError(err as AuthError) };
  }
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  await signOut(auth);
}
