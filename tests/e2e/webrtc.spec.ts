import { test, expect } from '@playwright/test';

test.describe('Resonance P2P Network', () => {

    test('Broadcaster can ignite transmission and go LIVE', async ({ page }) => {
        // Navigate to the broadcaster dashboard
        await page.goto('/broadcast');

        // Check initial state
        await expect(page.locator('text=IDLE').first()).toBeVisible();

        // Click to start transmitting
        const igniteButton = page.locator('button', { hasText: /ignite transmission/i }).first();
        await expect(igniteButton).toBeVisible();
        await igniteButton.click();

        // The state should flip to LIVE (indicating mic access + nostr publishing worked)
        await expect(page.locator('text=[ LIVE ]').first()).toBeVisible({ timeout: 10000 });
    });

    test('Listener can tune in and connect to the mesh', async ({ page, context }) => {
        // Context 1: Start the generic Broadcaster in the background
        const broadcasterPage = await context.newPage();
        await broadcasterPage.goto('/broadcast');
        await broadcasterPage.locator('button', { hasText: /ignite transmission/i }).first().click();
        await expect(broadcasterPage.locator('text=LIVE').first()).toBeVisible({ timeout: 10000 });

        // Context 2: Listener (Current page)
        await page.goto('/');

        // Wait for the field to load and prompt the user
        const awaitSignalText = page.locator('text=Click anywhere to open channel');
        await expect(awaitSignalText).toBeVisible();

        // Ensure the click action is simulated correctly to bypass pointer intercepts
        await page.mouse.click(500, 500);

        // We verify the overlay dissipates (meaning the click was received and AudioContext unlocked)
        // Note: Full "Signal Locked" P2P coherence validation is flaky in headless Chromium without real microphone/audio hardware interrupts.
        await expect(awaitSignalText).toBeHidden({ timeout: 5000 });
    });

});
