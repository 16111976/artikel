import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCurrentUser,
  loadRememberedCredentials,
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resetPassword
} from "./auth";

describe("auth", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(global.Math, "random").mockReturnValue(0.123456);
  });

  it("registriert und loggt user ein", () => {
    registerUser("Denis", "denis@example.com", "secret");
    const user = loginUser("denis@example.com", "secret", true);
    expect(user.email).toBe("denis@example.com");
    expect(getCurrentUser()?.name).toBe("Denis");
    expect(loadRememberedCredentials()?.email).toBe("denis@example.com");
  });

  it("unterstützt logout", () => {
    registerUser("Denis", "denis@example.com", "secret");
    loginUser("denis@example.com", "secret");
    logoutUser();
    expect(getCurrentUser()).toBeNull();
  });

  it("setzt passwort per email-reset zurück", () => {
    registerUser("Denis", "denis@example.com", "old");
    const code = requestPasswordReset("denis@example.com");
    resetPassword("denis@example.com", code, "new");
    const user = loginUser("denis@example.com", "new");
    expect(user.email).toBe("denis@example.com");
  });
});
