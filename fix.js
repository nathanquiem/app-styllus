const fs = require('fs');

const filePath = 'c:/Users/naelq/Documents/Projetos Antigravity/app-barbearia/src/components/AuthModal.tsx';
let text = fs.readFileSync(filePath, 'utf-8');

// Fix 1: Silent catch
text = text.replace('.then(() => {})', '.catch((e) => { console.warn(\'Fallback insert skipped:\', e?.message) })');

// Fix 2: Trim emails
text = text.replace('signInWithPassword({\r\n          email,\r\n          password', 'signInWithPassword({\r\n          email: email.trim(),\r\n          password');
text = text.replace('signUp({\r\n          email,\r\n          password,\r\n          options', 'signUp({\r\n          email: email.trim(),\r\n          password,\r\n          options');
text = text.replace('            phone,\r\n            email,\r\n            role', '            phone,\r\n            email: email.trim(),\r\n            role');

// If line endings are just \n instead of \r\n
text = text.replace('signInWithPassword({\n          email,\n          password', 'signInWithPassword({\n          email: email.trim(),\n          password');
text = text.replace('signUp({\n          email,\n          password,\n          options', 'signUp({\n          email: email.trim(),\n          password,\n          options');
text = text.replace('            phone,\n            email,\n            role', '            phone,\n            email: email.trim(),\n            role');

// Fix 3: iOS keyboard
const nameTarget = 'placeholder="Seu nome"\r\n                  required={!isLogin}';
const nameRepl = 'placeholder="Seu nome"\r\n                  autoComplete="name"\r\n                  autoCapitalize="words"\r\n                  required={!isLogin}';
text = text.replace(nameTarget, nameRepl);
text = text.replace(nameTarget.replace(/\r\n/g, '\n'), nameRepl.replace(/\r\n/g, '\n'));

const phoneTarget = '<Input \r\n                  id="phone" \r\n                  value={phone}\r\n                  onChange={(e) => setPhone(maskPhoneInput(e.target.value))}\r\n                  placeholder="(00) 00000-0000"\r\n                  required={!isLogin}\r\n                />';
const phoneRepl = '<Input \r\n                  id="phone" \r\n                  type="tel"\r\n                  value={phone}\r\n                  onChange={(e) => setPhone(maskPhoneInput(e.target.value))}\r\n                  placeholder="(00) 00000-0000"\r\n                  autoComplete="tel"\r\n                  required={!isLogin}\r\n                />';
text = text.replace(phoneTarget, phoneRepl);
text = text.replace(phoneTarget.replace(/\r\n/g, '\n'), phoneRepl.replace(/\r\n/g, '\n'));

const emailTarget = 'onChange={(e) => setEmail(e.target.value)}\r\n              placeholder="seu@email.com"\r\n              required';
const emailRepl = 'onChange={(e) => setEmail(e.target.value)}\r\n              placeholder="seu@email.com"\r\n              autoComplete="email"\r\n              autoCapitalize="none"\r\n              autoCorrect="off"\r\n              required';
text = text.replace(emailTarget, emailRepl);
text = text.replace(emailTarget.replace(/\r\n/g, '\n'), emailRepl.replace(/\r\n/g, '\n'));

fs.writeFileSync(filePath, text, 'utf-8');
console.log("Done fixing AuthModal.tsx with node");
