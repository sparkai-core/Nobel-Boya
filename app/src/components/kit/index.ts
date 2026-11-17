/**
 * Nobel ops UI kit. Every PM / Procurement / Vendor Portal page builds from these pieces so the
 * modules read as one product. Styles: src/styles/kit.css (classes prefixed `k-`).
 */
export * from "./core";
export * from "./page";
export * from "./register";
export * from "./charts";
export * from "./gantt";
export * from "./forms";
export { HeaderArt, type ArtName } from "./art";
export * from "./extra";
export { CommandPalette, NotificationBell, openPalette } from "./shell-tools";
