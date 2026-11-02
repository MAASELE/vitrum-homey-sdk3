# Vitrum for Homey Pro — SDK v3 update

Version **4.0.7**, based on [bypo/com.vitrum.v3](https://github.com/bypo/com.vitrum.v3)
(upstream 4.0.5, commit `49448663c7e50a5ef27faf56fbbe551729e4e8c6`),
with the additional device ID from MAASELE's original fork (`f0cf52d`).
Original authorship and GPL license are retained; see [LICENSE](LICENSE).

## Requirements

- Homey Pro running **12.9.0 or newer** (Node.js 22 app runtime).
- A computer with **Node.js 24 or newer** for Homey CLI 4.6.2.
- Your computer and Homey on the same network for installation.

Homey Pro Early 2019 on firmware 13.5.3 meets the firmware requirement.

## Install

Download this repository as a ZIP and extract it, or clone it:

```sh
git clone https://github.com/MAASELE/vitrum-homey-sdk3.git
cd vitrum-homey-sdk3
npm ci
npm run validate
npx homey login
npx homey select
npm run homey:install
```

In the Homey mobile app, open **Devices → Add device → Vitrum v3** and select
the matching model. Follow that device's manual for Z-Wave inclusion. If the
device is still joined to another controller, exclude it first, following its
manual. Do not guess inclusion button sequences from other models.

This project retains app ID `com.vitrum.v3`; installing it replaces an existing
installation with that ID. It is a development build, not an App Store release.

### Upload error: Parameter app is required

Use `npm run homey:install` in place of the plain `homey app install` command.
It uses the local CLI and performs an authenticated, read-only session request
immediately before uploading, preserving settings (`clean: false`).

A matching failure was reproduced in homey-api 3.21.2: an expired session makes
the first upload return HTTP 401; the automatic retry sends JSON instead of
multipart data, and Homey reports that the app field is missing. The helper
refreshes the session before creating that upload. The workaround is covered by
mocked transport tests, but has not been verified against this physical Homey.

If authentication fails, run the local CLI login and select commands above,
then try `npm run homey:install` again. No device removal or re-pairing is needed.

## Included drivers

- EU On/Off: 1, 2, 3, 4 and 6 buttons.
- EU Triac: 4 and 6 buttons.
- EU relay: 1 and 3 buttons.
- EU II roller shutter/curtain.
- BS On/Off: 1, 2 and 4 buttons.
- BS Satellite: 1 and 2 buttons.

Driver presence does not establish compatibility with every hardware revision.
No new Z-Wave fingerprints have been guessed from physical labels.

### Devices identified from labels

| Product code | Label | Status |
| --- | --- | --- |
| 03E010020 | I EU Master ON/OFF Unlimited | Requires Z-Wave identification; dedicated master driver not included |
| 01E060060 | VI EU Sat/OnOff/Tapp Triac Wireless | Compare reported IDs with six-button drivers |
| 02E020011 | II EU Tapparelle Wireless | Compare reported IDs with EU shutter driver |
| 01E040030 | IV EU Triac Wireless / Sat-OnOff-Tapp Triac | Compare reported IDs with four-button Triac driver |
| 01E030030 | III EU Satellite Wireless | Requires Z-Wave identification; dedicated EU satellite driver not included |
| 01E020090 | II EU electronic switch Wireless | Compare reported IDs with two-button drivers |

For a pairing failure or generic Z-Wave device, collect the manufacturer ID,
product type ID and product ID using [Homey's Z-Wave tools](https://tools.developer.homey.app/tools/zwave).
Include those IDs, model code, Homey firmware and symptoms in an issue. Several
inherited fingerprints overlap across drivers, so exact IDs are needed before
changing matching rules.

## Mixed panel: two switches and one shutter

For the confirmed panel with manufacturer **266**, product type **17408** and
product **25600**, enable **Two switches and shutter buttons** in the main
panel's advanced settings after updating the app. Existing pairing and all
four child devices remain in place; no exclusion/re-inclusion is needed.

The main panel gains **Raise shutter** and **Lower shutter** buttons:

- Raise sends the confirmed Switch 2 On command.
- Lower sends the confirmed Switch 4 On command.
- Switches 1 and 3 remain ordinary controls.

The buttons send one directional command per press. Initialization and changing
this setting send no movement commands. The setting is off by default and is
restricted to the confirmed model above.

On this installation, turning a direction switch Off reverses movement. Off
must therefore not be used as Stop. Pressing the same physical button again
stops the shutter, but the equivalent radio command still needs confirmation.
A Stop control and position percentage are not exposed. Check whether pressing
the same new Homey button twice also stops movement and report the result.

## Changes in 4.0.7

- Add optional stateless Raise/Lower controls for the confirmed mixed panel.
- Preserve existing child devices, switches, settings and Z-Wave fingerprints.
- Never use Off as a stop command or claim unmeasured shutter position.

## Changes in 4.0.6

- Update SDK v3 types to 1.8.3, Z-Wave library to 2.2.6 and Homey CLI to 4.6.2.
- Require Homey 12.9.0+ for the Node.js 22 dependency requirement.
- Remove unused native `sharp` dependency and deprecated Buffer constructors.
- Fix four-button Triac registration of the `vitrum4_scene` Flow card.
- Preserve the fork's additional product ID 20737 in the one-button EU driver.
- Keep runtime logging configuration out of the project, as in the original fork.
- Generate the final manifest from driver Compose files instead of duplicating drivers.

SDK v3 remains the current SDK; this refresh updates the libraries and tooling.
Runtime reference: [Homey Node.js 22 upgrade guide](https://apps.developer.homey.app/upgrade-guides/node-22).

## Verification

```sh
npm test
npm run validate
```

Validation checks the app at publish level. The regression test covers routing
the four-button Triac scene card. Real inclusion, endpoint control, shutter
behavior, reports and scenes still require physical hardware tests. Existing
lint errors across the inherited drivers have not been reformatted away.
