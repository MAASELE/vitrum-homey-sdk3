# Vitrum for Homey Pro — SDK v3 update

Version **4.0.6**, based on [bypo/com.vitrum.v3](https://github.com/bypo/com.vitrum.v3)
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
npx homey app install
```

In the Homey mobile app, open **Devices → Add device → Vitrum v3** and select
the matching model. Follow that device's manual for Z-Wave inclusion. If the
device is still joined to another controller, exclude it first, following its
manual. Do not guess inclusion button sequences from other models.

This project retains app ID `com.vitrum.v3`; installing it replaces an existing
installation with that ID. It is a development build, not an App Store release.

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
