import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');

function fixture() {
    const start = game.indexOf('function initTitleMusic()');
    const end = game.indexOf('function initAudio()', start);
    const gain = () => ({ gain: { value: 1 }, connect() {} });
    let playResolve;
    let playReject;
    const element = {
        pauses: 0, plays: 0, currentTime: 3,
        play() {
            this.plays++;
            return new Promise((resolve, reject) => { playResolve = resolve; playReject = reject; });
        },
        pause() { this.pauses++; },
    };
    const context = runInNewContext(`
        const GameState = { TITLE: 'title', HUB: 'hub' };
        let gameState = GameState.TITLE;
        let demoMode = null;
        let titleMusicEngine = null;
        let titleMusicPending = false;
        let titleMusicEpoch = 0;
        let titleMasterGain = null;
        let titleMediaMaster = null;
        ${game.slice(start, end)}
        ({
            play: initTitleMusic,
            enter: () => { gameState = GameState.HUB; stopTitleMusic(); },
            engine: () => titleMusicEngine,
            isPending: () => titleMusicPending,
        });
    `, {
        console: { log() {}, warn() {} },
        document: { getElementById: id => id === 'title-mp3' ? element : null },
        window: {},
        audioConfig: { titleVolume: 1 },
        getAudioCtx: () => ({ createAnalyser: gain, createMediaElementSource: gain, destination: {} }),
        createGain: gain,
    });
    return { ...context, element, resolve: () => playResolve(), reject: () => playReject(new Error('cancelled')) };
}

test('entering gameplay revokes an MP3 still starting and prevents a new title attempt', async () => {
    const f = fixture();
    f.play();
    f.play();
    assert.equal(f.element.plays, 1);
    f.enter();
    assert.equal(f.element.currentTime, 0);
    f.resolve();
    await new Promise(setImmediate);
    assert.equal(f.engine(), null);
    f.play();
    assert.equal(f.element.plays, 1);
});

test('a rejected title attempt after exit never starts a procedural fallback', async () => {
    const f = fixture();
    f.play();
    f.enter();
    f.reject();
    await new Promise(setImmediate);
    assert.equal(f.engine(), null);
    assert.equal(f.isPending(), false);
});

test('firing initializes the gameplay sound engine and never requests the title cue', () => {
    const gun = game.slice(game.indexOf('    shootGun() {'), game.indexOf('    startReload() {'));
    assert.match(gun, /initAudio\(\)/);
    assert.doesNotMatch(gun, /initTitleMusic\(\)/);
});
