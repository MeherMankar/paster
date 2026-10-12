/**
 * Applies the saved theme before first paint to avoid a flash, and marks the document as
 * JS-capable (`html.js`) so phone chrome that needs JavaScript (the bottom bar) can show
 * while the no-JS fallbacks (the desktop option chips) hide, without a flash either way.
 * Reads localStorage "theme" ∈ {light, dark, system}; defaults to system.
 */
const script = `(function(){var c=document.documentElement.classList;c.add('js');try{var t=localStorage.getItem('theme');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);d?c.add('dark'):c.remove('dark');}catch(e){}})();`;

export function ThemeScript({ nonce }: { nonce?: string }) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />;
}
