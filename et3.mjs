import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
const url = pathToFileURL('C:/Users/aksha/Desktop/G_DRIVE_UPLOAD/IQ/IQBOTLINUX/resume-builder/previews/E-hold/index.html').href;
const browser = await chromium.launch();
const t = await browser.newContext({viewport:{width:390,height:844}, hasTouch:true, isMobile:true});
const tp = await t.newPage();
await tp.goto(url,{waitUntil:'load'});
await tp.waitForTimeout(1400);
const gate = await tp.evaluate(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches);
// also: can the lean engage? dispatch pointermove over the card and read transform
const c = tp.locator('[data-card]');
const b = await c.boundingBox();
await tp.touchscreen.tap(b.x + b.width/2, b.y + b.height/2);
await tp.waitForTimeout(600);
const tr = await tp.evaluate(()=>document.querySelector('[data-card]').style.transform);
console.log('hover-gate (should be false):', gate = gate_check());
function gate_check(){ return gate; }
console.log('transform on touch tap:', tr = tr_check());
function tr_check(){ return tr; }
console.log('lean must be 0deg on touch:', tr);
await t.close();
// reduced motion: hover must not lean
const r = await browser.newContext({viewport:{width:1440,height:900}, reducedMotion:'reduce'});
const rp = await r.newPage();
await rp.goto(url,{waitUntil:'load'});
await rp.waitForTimeout(1200);
const b2 = await rp.locator('[data-card]').boundingBox();
await rp.mouse.move(b2.x + b2.width*0.8, b2.y + b2.height*0.3);
await rp.waitForTimeout(500);
const rr = await rp.evaluate(()=>document.querySelector('[data-card]').style.transform);
console.log('reduced-motion transform (must be ry only):', tr2 = rr);
await r.close();
await browser.close();
function tr_check(){ return 0; }