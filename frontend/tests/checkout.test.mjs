import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
let sequence = 0;
async function checkoutModule(api) {
  globalThis.__checkoutTestApi = api;
  const source = (await readFile(new URL('../lib/checkout.js', import.meta.url), 'utf8')).replace("import api from './axios';", 'const api = globalThis.__checkoutTestApi;');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${sequence++}`);
}
const tick = () => new Promise(setImmediate);
function setup(verify = async () => ({ data: { success: true } })) {
  let instance, verifications = 0;
  globalThis.window = { Razorpay: class {
    constructor(options) { this.options = options; this.events = {}; instance = this; }
    on(name, handler) { this.events[name] = handler; }
    open() {}
  } };
  const api = { post: async (path, body) => {
    if (path === '/checkout/session') { assert.equal(body.plan, 'monthly'); return { data: { subscriptionId: 'sub_mock' } }; }
    verifications++; return verify(body);
  } };
  return { api, get instance() { return instance; }, get verifications() { return verifications; } };
}
after(() => { delete globalThis.window; delete globalThis.document; delete globalThis.__checkoutTestApi; });
test('checkout lifecycle', async t => {
  await t.test('failed attempt followed by successful retry resolves and verifies once', async () => {
    const state = setup(); const { openCheckout } = await checkoutModule(state.api);
    const result = openCheckout('monthly'); let finished = false; result.then(() => { finished = true; });
    await tick(); state.instance.events['payment.failed'](); await tick(); assert.equal(finished, false);
    await state.instance.options.handler({ payment: 'success' }); assert.equal((await result).success, true); assert.equal(state.verifications, 1);
  });
  await t.test('dismissal during verification does not replace a successful result; duplicate callbacks do not verify twice', async () => {
    let release; const gate = new Promise(resolve => { release = resolve; });
    const state = setup(async () => { await gate; return { data: { success: true } }; });
    const { openCheckout } = await checkoutModule(state.api); const result = openCheckout('monthly');
    await tick(); const verifying = state.instance.options.handler({}); state.instance.options.modal.ondismiss();
    await state.instance.options.handler({}); assert.equal(state.verifications, 1);
    release(); await verifying; assert.equal((await result).success, true);
  });
  await t.test('failure then dismissal rejects without verifying payment', async () => {
    const state = setup(); const { openCheckout } = await checkoutModule(state.api); const result = openCheckout('monthly');
    const rejected = assert.rejects(result, /did not complete/);
    await tick(); state.instance.events['payment.failed'](); state.instance.options.modal.ondismiss();
    await rejected; assert.equal(state.verifications, 0);
  });
  await t.test('a verification error never reports checkout success', async () => {
    const state = setup(async () => { throw { response: { data: { message: 'Signature rejected' } } }; });
    const { openCheckout } = await checkoutModule(state.api); const result = openCheckout('monthly');
    const rejected = assert.rejects(result, /Signature rejected/);
    await tick(); await state.instance.options.handler({}); await rejected;
  });
  await t.test('SDK load failure clears cached loader so a subsequent checkout can succeed', async () => {
    const state = setup(); const Fake = globalThis.window.Razorpay; globalThis.window = {};
    let scripts = 0;
    globalThis.document = { createElement: () => ({ remove() {} }), body: { appendChild: script => {
      scripts++; queueMicrotask(() => {
        if (scripts === 1) script.onerror();
        else { globalThis.window.Razorpay = Fake; script.onload(); }
      });
    } } };
    const { openCheckout } = await checkoutModule(state.api);
    await assert.rejects(openCheckout('monthly'), /Could not load checkout/);
    const result = openCheckout('monthly'); await tick(); await state.instance.options.handler({});
    assert.equal((await result).success, true); assert.equal(scripts, 2);
  });
});
