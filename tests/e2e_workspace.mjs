import fs from 'fs';
import assert from 'assert';
import { chromium } from '../web/node_modules/playwright/index.mjs';

function getChromiumExecutable() {
  const candidates = [
    '/home/maulana/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
    '/home/maulana/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:8888';

async function main() {
  console.log('🚀 Memulai E2E Test: Notion-Style Workspace Collaboration...');
  console.log(`Target URL: ${BASE_URL}`);

  const execPath = getChromiumExecutable();
  console.log(`Chromium executable: ${execPath || 'default'}`);

  const browser = await chromium.launch({
    executablePath: execPath,
    headless: true,
  });

  try {
    // -------------------------------------------------------------
    // Context A: User A (Dev Admin)
    // -------------------------------------------------------------
    console.log('\n--- 1. Login User A (Admin) & Dashboard Initial State ---');
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    await pageA.goto(`${BASE_URL}/auth/dev-login?role=admin`);
    await pageA.goto(`${BASE_URL}/`);
    await pageA.waitForSelector('.navbar');

    const wsBtnA = pageA.locator('.workspace-switcher-btn');
    await wsBtnA.waitFor({ state: 'visible' });
    const wsNameA = (await wsBtnA.innerText()).trim();
    console.log(`✓ User A terautentikasi. Active Workspace: "${wsNameA}"`);

    // Verify FAB visible on dashboard
    const fabA = pageA.locator('.fab');
    await fabA.waitFor({ state: 'visible' });
    console.log('✓ Tombol FAB ("Tambah Perjalanan") terlihat di dashboard normal');

    // -------------------------------------------------------------
    // Test Bug Regression: Modal Buat Workspace hides FAB
    // -------------------------------------------------------------
    console.log('\n--- 2. Verifikasi Bug FAB Tersembunyi saat Modal Aktif ---');
    await wsBtnA.click();
    const btnCreateModal = pageA.locator('.workspace-dropdown button:has-text("Buat Ruang Kerja Baru")');
    await btnCreateModal.waitFor({ state: 'visible' });
    await btnCreateModal.click();

    const createModalOverlay = pageA.locator('.modal-overlay:has-text("Buat Ruang Kerja Baru")');
    await createModalOverlay.waitFor({ state: 'visible' });

    // Assert FAB is hidden
    const isFabHidden = await fabA.isHidden();
    assert.strictEqual(isFabHidden, true, 'FAILED: Tombol FAB harus disembunyikan saat modal terbuka!');
    console.log('✓ Tombol FAB berhasil disembunyikan saat modal "Buat Ruang Kerja Baru" aktif');

    // Close create modal
    const btnBatal = createModalOverlay.locator('button:has-text("Batal")');
    await btnBatal.click();
    await createModalOverlay.waitFor({ state: 'detached' });

    // Assert FAB is visible again
    await fabA.waitFor({ state: 'visible' });
    console.log('✓ Tombol FAB kembali terlihat setelah modal ditutup');

    // -------------------------------------------------------------
    // Context A: Ambil Join Code dari Kelola Workspace
    // -------------------------------------------------------------
    console.log('\n--- 3. User A Mendapatkan Kode Undangan Workspace ---');
    await wsBtnA.click();
    const btnSettings = pageA.locator('.workspace-dropdown button:has-text("Kelola Anggota & Kode")');
    await btnSettings.waitFor({ state: 'visible' });
    await btnSettings.click();

    const settingsModal = pageA.locator('.modal-overlay:has-text("Kelola Ruang Kerja")');
    await settingsModal.waitFor({ state: 'visible' });

    const codeSpan = settingsModal.locator('.workspace-code-box span[style*="monospace"]');
    await codeSpan.waitFor({ state: 'visible' });
    const joinCode = (await codeSpan.innerText()).trim();
    console.log(`✓ Kode Undangan User A diperoleh: "${joinCode}"`);
    assert.match(joinCode, /^[A-Z0-9]{6}$/, 'FAILED: Kode undangan harus berupa 6 karakter alfanumerik kapital');

    const btnCloseSettings = settingsModal.locator('button:has-text("Tutup")');
    await btnCloseSettings.click();
    await settingsModal.waitFor({ state: 'detached' });

    // -------------------------------------------------------------
    // Context B: User B (Dev User) Bergabung ke Workspace User A
    // -------------------------------------------------------------
    console.log('\n--- 4. User B Login & Bergabung Menggunakan Kode Undangan ---');
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await pageB.goto(`${BASE_URL}/auth/dev-login?role=user`);
    await pageB.goto(`${BASE_URL}/`);
    await pageB.waitForSelector('.navbar');

    const wsBtnB = pageB.locator('.workspace-switcher-btn');
    await wsBtnB.waitFor({ state: 'visible' });
    console.log(`✓ User B terautentikasi. Default: "${(await wsBtnB.innerText()).trim()}"`);

    await wsBtnB.click();
    const btnJoinModal = pageB.locator('.workspace-dropdown button:has-text("Gabung via Kode")');
    await btnJoinModal.waitFor({ state: 'visible' });
    await btnJoinModal.click();

    const joinModal = pageB.locator('.modal-overlay:has-text("Gabung Ruang Kerja")');
    await joinModal.waitFor({ state: 'visible' });

    const codeInput = joinModal.locator('input[placeholder="ABC123"]');
    await codeInput.fill(joinCode);

    const btnSubmitJoin = joinModal.locator('button:has-text("Gabung")');
    await Promise.all([
      pageB.waitForEvent('load'),
      btnSubmitJoin.click(),
    ]);

    await pageB.waitForSelector('.navbar');

    const wsBtnBAfter = pageB.locator('.workspace-switcher-btn');
    await wsBtnBAfter.waitFor({ state: 'visible' });
    console.log(`✓ User B berhasil bergabung dan beralih ke workspace User A: "${(await wsBtnBAfter.innerText()).trim()}"`);

    // -------------------------------------------------------------
    // Context B: Membuat Trip Baru di Workspace User A
    // -------------------------------------------------------------
    const tripName = `Dinas Bersama Semarang E2E ${Date.now()}`;
    console.log(`\n--- 5. User B Membuat Perjalanan Baru: "${tripName}" ---`);

    const fabB = pageB.locator('.fab');
    await fabB.waitFor({ state: 'visible' });
    await fabB.click();

    await pageB.waitForURL('**/trips/new');
    await pageB.waitForSelector('#nama');

    await pageB.locator('#nama').fill(tripName);

    // Isi Kota Tujuan
    const tujuanInput = pageB.locator('#tujuan, input[placeholder*="kota"]');
    await tujuanInput.fill('Semarang');
    await pageB.keyboard.press('Enter');

    // Tanggal
    await pageB.locator('#mulai').fill('2026-08-10');
    await pageB.locator('#selesai').fill('2026-08-12');

    // Uang Dinas
    const uangInput = pageB.locator('input[placeholder*="0"]').first();
    if (await uangInput.isVisible()) {
      await uangInput.fill('3500000');
    }

    const btnSubmitTrip = pageB.locator('button[type="submit"]:has-text("Simpan")');
    await btnSubmitTrip.click();

    // Tunggu halaman detail perjalanan terbuka
    await pageB.waitForURL(/\/trips\/[0-9a-f-]+/);
    const detailTitle = pageB.locator('.detail-hero-title');
    await detailTitle.waitFor({ state: 'visible' });
    assert.strictEqual(await detailTitle.innerText(), tripName, 'FAILED: Judul perjalanan tidak sesuai!');
    console.log(`✓ Perjalanan baru berhasil dibuat oleh User B di workspace bersama`);

    // -------------------------------------------------------------
    // Context A: User A Memeriksa Trip di Dashboard
    // -------------------------------------------------------------
    console.log('\n--- 6. Verifikasi Multi-User: User A Melihat Perjalanan Baru di Dashboard ---');
    await pageA.goto(`${BASE_URL}/`);
    await pageA.waitForSelector('.navbar');

    const tripCardInA = pageA.locator(`.ticket-card:has-text("${tripName}")`);
    await tripCardInA.waitFor({ state: 'visible', timeout: 5000 });
    console.log(`✓ Perjalanan "${tripName}" langsung muncul di dashboard User A!`);

    const authorTag = tripCardInA.locator('.badge:has-text("Dev User"), span:has-text("Dev User")');
    if (await authorTag.isVisible()) {
      console.log(`✓ Terdeteksi tag pembuat kolaborator: "${(await authorTag.innerText()).trim()}"`);
    }

    // -------------------------------------------------------------
    // Context B: Isolasi Workspace (Ganti ke Personal Workspace)
    // -------------------------------------------------------------
    console.log('\n--- 7. Verifikasi Isolasi Ruang Kerja: User B Kembali ke Personal Workspace ---');
    await pageB.goto(`${BASE_URL}/`);
    await pageB.waitForSelector('.navbar');

    const switcherB = pageB.locator('.workspace-switcher-btn');
    await switcherB.click();

    // User B memilih workspace miliknya sendiri (yang memiliki badge Pemilik)
    const personalWsItem = pageB.locator('.workspace-dropdown-item:has-text("Pemilik")');
    await personalWsItem.waitFor({ state: 'visible' });

    await Promise.all([
      pageB.waitForEvent('load'),
      personalWsItem.click(),
    ]);

    await pageB.waitForSelector('.navbar');

    const activeWsAfterSwitch = await pageB.evaluate(() => localStorage.getItem('active_workspace_id'));
    console.log(`✓ Active workspace ID setelah beralih ke personal: ${activeWsAfterSwitch}`);

    const tripInPersonalB = pageB.locator(`.ticket-card:has-text("${tripName}")`);
    const isTripVisibleInPersonal = await tripInPersonalB.isVisible();
    assert.strictEqual(isTripVisibleInPersonal, false, 'FAILED: Perjalanan workspace bersama tidak boleh bocor ke personal space!');
    console.log(`✓ Terverifikasi: Perjalanan bersama "${tripName}" TIDAK muncul di personal workspace User B!`);

    console.log('\n🎉 ===============================================================');
    console.log('🎉 SEMUA PENGUJIAN END-TO-END NOTION-STYLE WORKSPACE BERHASIL!   ');
    console.log('🎉 ===============================================================\n');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
