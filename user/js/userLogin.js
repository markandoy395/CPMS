import { apiRequest } from "./api.js";
import { renderVisitorProfile } from "./profile.js";
import { clearPublicSession, publicAuthToken, savePublicSession } from "./storage.js";
import { state } from "./state.js";
import { escapeHtml } from "./ui.js";
import { renderNotifications } from "./notifications.js";

let loginModal;
let mode = "login";

export function ensureUserLogin() {
  if (!loginModal) createLoginScreen();
  fillLoginForm();

  if (hasRequiredLogin()) {
    showGateway();
    return;
  }

  setLoginMode("login");
  showLogin();
  loginModal.querySelector("#loginUsername").focus();
}

export async function logoutPublicUser() {
  if (!publicAuthToken()) {
    clearPublicSession();
    renderVisitorProfile();
    ensureUserLogin();
    return;
  }

  try {
    await apiRequest("/public/auth/logout", { method: "POST" });
  } catch {
    // Local logout still matters if the server is unavailable.
  } finally {
    clearPublicSession();
    renderVisitorProfile();
    renderNotifications();
    ensureUserLogin();
  }
}

function createLoginScreen() {
  loginModal = document.createElement("div");
  loginModal.className = "login-screen";
  loginModal.id = "userLoginScreen";
  loginModal.innerHTML = loginMarkup();
  loginModal.querySelector("#userLoginForm").addEventListener("submit", submitLogin);
  loginModal.querySelector("#toggleLoginMode").addEventListener("click", toggleMode);
  document.body.prepend(loginModal);
}

function loginMarkup() {
  return `
    <section class="login-panel" aria-labelledby="userLoginTitle">
      <div class="login-brand">
        <img src="/assets/image/logo.png" alt="CPMS">
        <span>User Gateway</span>
      </div>
      <div class="login-head">
        <h1 id="userLoginTitle">User Login</h1>
        <p id="userLoginSubtitle">Sign in with your username and password.</p>
      </div>
      <form id="userLoginForm">
        <p class="alert error login-error" id="loginError" hidden></p>
        <div class="form-grid">
          <label class="register-only full-width" hidden>
            <span>Full Name *</span>
            <input id="loginBorrowerName" autocomplete="name" />
          </label>
          <label>
            <span>Username *</span>
            <input id="loginUsername" autocomplete="username" required />
          </label>
          <label>
            <span>Password *</span>
            <input id="loginPassword" type="password" autocomplete="current-password" minlength="8" required />
          </label>
          <label class="register-only" hidden>
            <span>Department *</span>
            <input id="loginDepartment" autocomplete="organization" />
          </label>
          <label class="register-only" hidden>
            <span>Room Name *</span>
            <input id="loginRoomName" />
          </label>
        </div>
        <div class="form-actions login-actions">
          <button class="btn btn-secondary" id="toggleLoginMode" type="button">Create Account</button>
          <button class="btn btn-primary" id="loginSubmitButton" type="submit">Login</button>
        </div>
      </form>
    </section>
  `;
}

function fillLoginForm() {
  const profile = state.borrowerProfile || {};
  loginModal.querySelector("#loginBorrowerName").value = profile.borrower_name || "";
  loginModal.querySelector("#loginDepartment").value = profile.department || "";
  loginModal.querySelector("#loginRoomName").value = profile.room_name || "";
}

async function submitLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  trimFormInputs(form);
  if (!form.reportValidity()) return;

  setLoginBusy(true);
  showLoginError("");

  try {
    const payload = await apiRequest(
      mode === "register" ? "/public/auth/register" : "/public/auth/login",
      { method: "POST", body: loginBody(form) },
    );
    savePublicSession(payload.token, payload.user);
    renderVisitorProfile();
    showGateway();
  } catch (error) {
    showLoginError(error.message);
  } finally {
    setLoginBusy(false);
  }
}

function toggleMode() {
  setLoginMode(mode === "login" ? "register" : "login");
}

function setLoginMode(nextMode) {
  mode = nextMode;
  const isRegister = mode === "register";

  loginModal.querySelector("#userLoginTitle").textContent = isRegister ? "Create User Account" : "User Login";
  loginModal.querySelector("#userLoginSubtitle").textContent = isRegister
    ? "Create a username and password before borrowing."
    : "Sign in with your username and password.";
  loginModal.querySelector("#loginSubmitButton").textContent = isRegister ? "Create Account" : "Login";
  loginModal.querySelector("#toggleLoginMode").textContent = isRegister ? "Back to Login" : "Create Account";
  loginModal.querySelector("#loginPassword").autocomplete = isRegister ? "new-password" : "current-password";

  loginModal.querySelectorAll(".register-only").forEach((element) => {
    element.hidden = !isRegister;
    element.querySelector("input").required = isRegister;
  });
  showLoginError("");
}

function loginBody(form) {
  const body = {
    username: form.querySelector("#loginUsername").value,
    password: form.querySelector("#loginPassword").value,
  };

  if (mode === "register") {
    body.borrower_name = form.querySelector("#loginBorrowerName").value;
    body.department = form.querySelector("#loginDepartment").value;
    body.room_name = form.querySelector("#loginRoomName").value;
  }

  return body;
}

function setLoginBusy(isBusy) {
  loginModal.querySelector("#loginSubmitButton").disabled = isBusy;
  loginModal.querySelector("#toggleLoginMode").disabled = isBusy;
}

function showLoginError(message) {
  const errorBox = loginModal.querySelector("#loginError");
  errorBox.hidden = !message;
  errorBox.innerHTML = escapeHtml(message);
}

function trimFormInputs(form) {
  form.querySelectorAll("input").forEach((input) => { input.value = input.value.trim(); });
}

function hasRequiredLogin() {
  const profile = state.borrowerProfile || {};
  return Boolean(publicAuthToken()) && ["borrower_name", "department", "room_name"].every((key) => String(profile[key] || "").trim());
}

function showGateway() {
  document.querySelector(".page-shell").hidden = false;
  loginModal.hidden = true;
}

function showLogin() {
  document.querySelector(".page-shell").hidden = true;
  loginModal.hidden = false;
}
