let installPrompt = null;
let installed = false;
const panel = document.getElementById('pwa-install');
const button = document.getElementById('install-app');
const status = document.getElementById('install-status');
const standalone = window.matchMedia('(display-mode: standalone)');

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  if (standalone.matches) return;
  installPrompt = event;
  panel.hidden = false;
  button.hidden = false;
  button.disabled = false;
  status.textContent = 'ホーム画面からアプリとして開けます。';
});

button.addEventListener('click', async () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  button.disabled = true;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    button.hidden = true;
    if (installed) return;
    status.textContent = choice.outcome === 'accepted'
      ? 'インストールを受け付けました。完了通知をお待ちください。'
      : 'インストールをキャンセルしました。再度試すにはページを再読み込みしてください。';
  } catch {
    button.hidden = true;
    status.textContent = 'インストールを開始できませんでした。ページを再読み込みしてお試しください。';
  }
});

window.addEventListener('appinstalled', () => {
  installed = true;
  installPrompt = null;
  button.hidden = true;
  status.textContent = '肉フェアをインストールしました。ホーム画面から開けます。';
});
standalone.addEventListener('change', () => {
  if (standalone.matches) panel.hidden = true;
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', {scope: './'}).catch(error => {
    console.warn('肉フェアのService Worker登録に失敗しました', error);
  });
}
