import { createApp } from "vue";
import "vue-sonner/style.css";
import App from "./App.vue";
import "./style.css";

// shadcn themes by the .dark class; follow the system setting.
const dark = window.matchMedia("(prefers-color-scheme: dark)");
const applyTheme = () => document.documentElement.classList.toggle("dark", dark.matches);
applyTheme();
dark.addEventListener("change", applyTheme);

createApp(App).mount("#app");
