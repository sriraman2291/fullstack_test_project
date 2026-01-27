const API = "https://fullstack-test-project.onrender.com";

//loading spinner
function showLoader() {
  const loader = document.getElementById("loader");
  if (loader) {
    loader.classList.remove("hidden");
  }
}

function hideLoader() {
  const loader = document.getElementById("loader");
  if (loader) {
    loader.classList.add("hidden");
  }
}


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
  showLoader(); // 👈 START loading

  try {
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

      // Retry original request with new token
      accessToken = localStorage.getItem("accessToken");
      options.headers.Authorization = `Bearer ${accessToken}`;
      response = await fetch(url, options);
    }

    return response;
  } finally {
    hideLoader(); // 👈 STOP loading (always)
  }
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
  showLoader();

  try {
    const res = await fetch(`${API}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: regUser.value,
        password: regPass.value
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message);
    }

    msg.className = "message success";
    msg.innerText = "Registered successfully. Please login.";
  } catch (err) {
    msg.className = "message error";
    msg.innerText = err.message;
  } finally {
    hideLoader();
  }
}

// Login
async function login() {
  showLoader();

  try {
    const res = await fetch(`${API}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: loginUser.value,
        password: loginPass.value
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message);
    }

    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);

    window.location.href = "dashboard.html";
  } catch (err) {
    msg.className = "message error";
    msg.innerText = err.message;
  } finally {
    hideLoader();
  }
}

// Logout
async function logout() {
  await fetch("https://fullstack-test-project.onrender.com/api/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refreshToken: localStorage.getItem("refreshToken")
    })
  });

  localStorage.clear();
  window.location.href = "index.html";
}
/* =========================
   PROTECTED APIs
========================= */

// Get profile
async function getProfile() {
  showLoader();

  const response = await fetchWithAuth(
    "https://fullstack-test-project.onrender.com/api/profile"
  );

  hideLoader();

  if (!response) return;

  const data = await response.json();
  document.getElementById("username").innerText = data.username;
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
