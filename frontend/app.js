const API = "https://fullstack-test-project.onrender.com";

let regPass;
let registerBtn;

document.addEventListener("DOMContentLoaded", () => {
  regPass = document.getElementById("reg-password");
  registerBtn = document.getElementById("registerBtn");

  if (regPass) {
    regPass.addEventListener("input", validatePassword);
  }
});



function isLoggedIn() {
  return !!localStorage.getItem("accessToken");
}

function protectRoute() {
  if (!isLoggedIn()) {
    window.location = "index.html";
  }
}

function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location = "dashboard.html";
  }
}


/* =========================
   AUTH HELPERS
========================= */

// Centralized fetch with auto-refresh
async function fetchWithAuth(url, options = {}) {
  let accessToken = localStorage.getItem("accessToken");

  options.headers = {
    ...options.headers,
    Authorization: `Bearer ${accessToken}`
  };

  let response = await fetch(url, options);

  // If access token expired
  if (response.status === 401 || response.status === 403) {
    const refreshed = await refreshAccessToken();

    if (!refreshed) {
      logoutAndRedirect();
      return null;
    }

    // Retry original request
    accessToken = localStorage.getItem("accessToken");
    options.headers.Authorization = `Bearer ${accessToken}`;
    response = await fetch(url, options);
  }

  return response;
}

// Refresh access token
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return false;

  const res = await fetch(`${API}/api/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  if (!res.ok) return false;

  const data = await res.json();
  localStorage.setItem("accessToken", data.accessToken);
  localStorage.setItem("refreshToken", data.refreshToken);

  return true;
}

// Logout helper
function logoutAndRedirect() {
  localStorage.clear();
  window.location = "index.html";
}

/* =========================
   PUBLIC APIs
========================= */

// Register
async function register() {
  if (registerBtn.disabled) {
    msg.className = "message error";
    msg.innerText = "Password does not meet requirements";
    return;
  }

  const res = await fetch(`${API}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: regUser.value,
      password: regPass.value
    })
  });

  const data = await res.json();

  if (res.ok) {
    msg.className = "message success";
    msg.innerText = data.message;
    setTimeout(() => window.location = "index.html", 1500);
  } else {
    msg.className = "message error";
    msg.innerText = data.message;
  }
}

// Login
async function login() {
  const res = await fetch(`${API}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: loginUser.value,
      password: loginPass.value
    })
  });

  const data = await res.json();

  if (res.ok) {
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    window.location = "dashboard.html";
  } else {
    msg.className = "message error";
    msg.innerText = data.message;
  }
}

// Logout
async function logout() {
  const refreshToken = localStorage.getItem("refreshToken");

  await fetch(`${API}/api/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  logoutAndRedirect();
}

/* =========================
   PROTECTED APIs
========================= */

// Get profile
async function getProfile() {
  const res = await fetchWithAuth(`${API}/api/profile`);
  if (!res) return;

  const data = await res.json();
  output.innerText = JSON.stringify(data, null, 2);
}

// Delete user
async function deleteUser() {
  const res = await fetchWithAuth(`${API}/api/user`, {
    method: "DELETE"
  });

  if (!res) return;

  if (res.ok) {
    alert("Account deleted");
    logoutAndRedirect();
  }
}

/* =========================
   UI FEATURES
========================= */

// Password rules validation
function validatePassword() {
  const password = regPass.value;

  const rules = {
    len: {
      valid: password.length >= 8,
      text: "At least 8 characters"
    },
    upper: {
      valid: /[A-Z]/.test(password),
      text: "One uppercase letter"
    },
    lower: {
      valid: /[a-z]/.test(password),
      text: "One lowercase letter"
    },
    num: {
      valid: /[0-9]/.test(password),
      text: "One number"
    },
    special: {
      valid: /[@#$!%*?&]/.test(password),
      text: "One special character"
    }
  };

  let allValid = true;

  Object.keys(rules).forEach(id => {
    const el = document.getElementById(id);

    if (rules[id].valid) {
      el.className = "valid";
      el.innerText = "✔ " + rules[id].text;
    } else {
      el.className = "invalid";
      el.innerText = "❌ " + rules[id].text;
      allValid = false;
    }
  });

  registerBtn.disabled = !allValid;
}

/* =========================
   EYE ICON (SVG API + ANIMATION)
========================= */

async function loadIcon(name) {
  const res = await fetch(`icons/${name}.svg`);
  return await res.text();
}

document.querySelectorAll(".eye").forEach(async eye => {
  eye.innerHTML = await loadIcon("eye");

  eye.addEventListener("click", async () => {
    const input = document.getElementById(eye.dataset.target);

    eye.classList.add("animate");

    if (input.type === "password") {
      input.type = "text";
      eye.innerHTML = await loadIcon("eye-slash");
    } else {
      input.type = "password";
      eye.innerHTML = await loadIcon("eye");
    }

    setTimeout(() => eye.classList.remove("animate"), 150);
  });
});
