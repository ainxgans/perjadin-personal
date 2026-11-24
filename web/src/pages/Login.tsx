import { Component } from 'solid-js';

const Login: Component = () => {
  return (
    <div class="login-page">
      <div class="login-card">
        <h1>Perjadin</h1>
        <p>Catatan keuangan perjalanan dinas</p>
        <a href="/auth/google" class="btn btn-google">
          Login dengan Google
        </a>
      </div>
    </div>
  );
};

export default Login;
