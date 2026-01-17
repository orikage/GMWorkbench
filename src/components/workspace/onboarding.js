export function createOnboarding({ onRequestSample, onDismiss } = {}) {
  const section = document.createElement('section');
  section.className = 'workspace__onboarding';

  const title = document.createElement('h2');
  title.className = 'workspace__onboarding-title';
  title.textContent = 'はじめての使い方';

  const description = document.createElement('p');
  description.className = 'workspace__onboarding-description';
  description.textContent =
    'PDF をまだ開いていない場合は、下のステップとサンプルPDFで主要な流れを体験できます。検索語やアウトラインの例も用意しています。';

  const steps = document.createElement('ol');
  steps.className = 'workspace__onboarding-steps';

  const stepItems = [
    {
      title: 'サンプルPDFで機能を確認',
      body: '下のボタンから開くサンプルには検索語とアウトラインが登録されています。検索バーやアウトラインパネルで挙動を確かめてください。',
    },
    {
      title: 'PDF を取り込む',
      body: 'ドロップゾーンにドラッグ＆ドロップするか、「PDFを開く」ボタンからファイルを選択します。',
    },
    {
      title: '取り込みキューで並べ替える',
      body: '取り込んだファイルはキューに入り、任意のタイミングでワークスペースへ配置できます。',
    },
    {
      title: 'ワークスペースで整理する',
      body: 'ウィンドウを移動・拡大しながらページ移動やメモでシナリオを整理します。',
    },
  ];

  stepItems.forEach(({ title: stepTitle, body }) => {
    const item = document.createElement('li');
    item.className = 'workspace__onboarding-step';

    const itemTitle = document.createElement('h3');
    itemTitle.className = 'workspace__onboarding-step-title';
    itemTitle.textContent = stepTitle;

    const itemBody = document.createElement('p');
    itemBody.className = 'workspace__onboarding-step-body';
    itemBody.textContent = body;

    item.append(itemTitle, itemBody);
    steps.append(item);
  });

  const actions = document.createElement('div');
  actions.className = 'workspace__onboarding-actions';

  const sampleButton = document.createElement('button');
  sampleButton.type = 'button';
  sampleButton.className = 'workspace__onboarding-button';
  sampleButton.textContent = 'サンプルPDFを開いてみる';

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'workspace__onboarding-dismiss';
  dismissButton.textContent = 'ガイドを閉じる（次回から表示しない）';

  const status = document.createElement('p');
  status.className = 'workspace__onboarding-status';
  status.setAttribute('role', 'status');
  status.hidden = true;

  const resetStatus = () => {
    status.hidden = true;
    status.textContent = '';
    status.classList.remove('workspace__onboarding-status--error');
  };

  let loading = false;
  let dismissing = false;

  sampleButton.addEventListener('click', async () => {
    if (loading) {
      return;
    }

    loading = true;
    sampleButton.disabled = true;
    status.hidden = false;
    status.textContent = 'サンプルPDFを読み込み中…';
    status.classList.remove('workspace__onboarding-status--error');

    try {
      await onRequestSample?.();
      resetStatus();
    } catch (error) {
      status.hidden = false;
      status.textContent = 'サンプルの読み込みに失敗しました。もう一度お試しください。';
      status.classList.add('workspace__onboarding-status--error');
    } finally {
      loading = false;
      sampleButton.disabled = false;
    }
  });

  dismissButton.addEventListener('click', async () => {
    if (dismissing) {
      return;
    }

    dismissing = true;
    dismissButton.disabled = true;
    resetStatus();
    status.hidden = false;
    status.textContent = 'ガイド設定を更新しています…';

    try {
      await onDismiss?.();
      status.hidden = false;
      status.textContent = '次回以降、ガイドは表示されません。';
    } catch (error) {
      status.hidden = false;
      status.textContent = 'ガイド設定の更新に失敗しました。もう一度お試しください。';
      status.classList.add('workspace__onboarding-status--error');
    } finally {
      dismissing = false;
      dismissButton.disabled = false;
    }
  });

  actions.append(sampleButton, dismissButton, status);

  section.append(title, description, steps, actions);

  const setActive = (active) => {
    section.hidden = !active;

    if (!active) {
      resetStatus();
    }
  };

  setActive(true);

  return {
    element: section,
    setActive,
    resetStatus,
  };
}
