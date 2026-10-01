# Changelog

## [1.18.1](https://github.com/kontourai/ui/compare/v1.18.0...v1.18.1) (2026-10-01)


### Documentation

* **design:** record owner decisions on the open design items ([#111](https://github.com/kontourai/ui/issues/111)) ([b3ca560](https://github.com/kontourai/ui/commit/b3ca5605d2e7bdc4021d1d1135481b0e0df5cafa))

## [1.18.0](https://github.com/kontourai/ui/compare/v1.17.2...v1.18.0) (2026-09-29)


### Features

* **contrast:** require brand text to meet AA on every surface; retint four brands ([#109](https://github.com/kontourai/ui/issues/109)) ([6122163](https://github.com/kontourai/ui/commit/61221631939319a8a8b8288f217e12dcfe2584f0)), closes [#77](https://github.com/kontourai/ui/issues/77)

## [1.17.2](https://github.com/kontourai/ui/compare/v1.17.1...v1.17.2) (2026-09-29)


### Fixes

* trim trust-state detail in every renderer; reject hidden chip borders ([#106](https://github.com/kontourai/ui/issues/106)) ([70fa4f4](https://github.com/kontourai/ui/commit/70fa4f474e67a1d303d504af307d7125489c670e)), closes [#102](https://github.com/kontourai/ui/issues/102)

## [1.17.1](https://github.com/kontourai/ui/compare/v1.17.0...v1.17.1) (2026-09-29)


### Fixes

* **tokens:** nearest-scope themes and modes, faint text AA, visible button focus ([#101](https://github.com/kontourai/ui/issues/101)) ([ecc0d42](https://github.com/kontourai/ui/commit/ecc0d426857eb69c88824dfa49f80d72336cc077))

## [1.17.0](https://github.com/kontourai/ui/compare/v1.16.0...v1.17.0) (2026-09-29)


### Features

* **trust-state:** export a framework-free trust-state renderer and chip stylesheet ([#98](https://github.com/kontourai/ui/issues/98)) ([7a2d290](https://github.com/kontourai/ui/commit/7a2d2902f79d368c15481e15a191f39d2f58c353))
* **trust:** TrustBasis line rendering Surface's claim basis view ([#91](https://github.com/kontourai/ui/issues/91)) ([e54dfea](https://github.com/kontourai/ui/commit/e54dfeaee371f37e613e9327ca1a0230ce3869b1))

## [1.16.0](https://github.com/kontourai/ui/compare/v1.15.0...v1.16.0) (2026-09-28)


### Features

* **contrast:** export the white-label contrast validator as @kontourai/ui/contrast ([#93](https://github.com/kontourai/ui/issues/93)) ([9fd216d](https://github.com/kontourai/ui/commit/9fd216d32912ef0b01158324fbe3095db9b38284))

## [1.15.0](https://github.com/kontourai/ui/compare/v1.14.0...v1.15.0) (2026-09-27)


### Features

* **trust:** trust-state tokens and TrustState using Surface's claim-status vocabulary ([#86](https://github.com/kontourai/ui/issues/86)) ([92e9334](https://github.com/kontourai/ui/commit/92e933415cc2500e6a4a6fb5229f82d76968c436))

## [1.14.0](https://github.com/kontourai/ui/compare/v1.13.0...v1.14.0) (2026-09-27)


### Features

* **tokens:** separate brand from action and focus roles ([#79](https://github.com/kontourai/ui/issues/79)) ([52ae45c](https://github.com/kontourai/ui/commit/52ae45ca98eb16c6abcdd04220204a13e99dc21f))

## [1.13.0](https://github.com/kontourai/ui/compare/v1.12.0...v1.13.0) (2026-09-27)


### Features

* **design:** ship a canonical DESIGN.md with token front matter generated from tokens/ ([#76](https://github.com/kontourai/ui/issues/76)) ([91e93ec](https://github.com/kontourai/ui/commit/91e93ece85b2a036c9177acf62ab1e8ae3515e8f))
* **explorer:** generate the public design-system contract ([#68](https://github.com/kontourai/ui/issues/68)) ([cc4ca43](https://github.com/kontourai/ui/commit/cc4ca43d93b9dd78295368bbeb842fc7ac5d35bc))
* **tokens:** WCAG contrast conformance joins the check chain ([#64](https://github.com/kontourai/ui/issues/64)) ([0723acf](https://github.com/kontourai/ui/commit/0723acf89de59b451ffb99ab0d71b24f4131be22))

## [1.12.0](https://github.com/kontourai/ui/compare/v1.11.2...v1.12.0) (2026-07-28)


### Features

* ship product marks for the full suite (15 new icons) ([#58](https://github.com/kontourai/ui/issues/58)) ([52c9341](https://github.com/kontourai/ui/commit/52c93419f30aa26e53aa9674dad58deb49ecbd51))

## [1.11.2](https://github.com/kontourai/ui/compare/v1.11.1...v1.11.2) (2026-07-27)


### Documentation

* **fonts:** use US spelling in the vendored-font provenance notes ([#55](https://github.com/kontourai/ui/issues/55)) ([cacff22](https://github.com/kontourai/ui/commit/cacff221b1704f4c9bb52bf4484c5a6811ab8d35))

## [1.11.1](https://github.com/kontourai/ui/compare/v1.11.0...v1.11.1) (2026-07-27)


### Fixes

* **tokens:** self-host the brand faces so CSP-restricted consumers get them ([#52](https://github.com/kontourai/ui/issues/52)) ([413806e](https://github.com/kontourai/ui/commit/413806ead6de9b9c19914dbad881c901a58e0727))


### Documentation

* content sweep — accuracy and clarity fixes ([#47](https://github.com/kontourai/ui/issues/47)) ([d8365a6](https://github.com/kontourai/ui/commit/d8365a6bda48f093bc88ca6f0eb8d71f08f00656))
* finish Kontour UI naming migration ([#44](https://github.com/kontourai/ui/issues/44)) ([c01ca9f](https://github.com/kontourai/ui/commit/c01ca9fe03ac064a95f50fc188183159214af294))

## [1.11.0](https://github.com/kontourai/ui/compare/v1.10.0...v1.11.0) (2026-06-28)


### Features

* **overlays:** add Tooltip and Popover ([#38](https://github.com/kontourai/ui/issues/38)) ([c7e60ad](https://github.com/kontourai/ui/commit/c7e60adda4bf94566b6a193243888058e930d75c))

## [1.10.0](https://github.com/kontourai/ui/compare/v1.9.0...v1.10.0) (2026-06-28)


### Features

* **toast:** add Toast feedback primitive + imperative stack ([#36](https://github.com/kontourai/ui/issues/36)) ([5695a27](https://github.com/kontourai/ui/commit/5695a270240fbda8b9c83e31eb7829ec3310fe79))

## [1.9.0](https://github.com/kontourai/ui/compare/v1.8.0...v1.9.0) (2026-06-28)


### Features

* **controls:** build out the form-control layer ([#31](https://github.com/kontourai/ui/issues/31)) ([1a9bb67](https://github.com/kontourai/ui/commit/1a9bb67fd14ac9178bedab554549079115b9d6df))
* **dialog:** add Dialog overlay + stateful-primitive convention ([#35](https://github.com/kontourai/ui/issues/35)) ([eacd099](https://github.com/kontourai/ui/commit/eacd09919dc54781d919032b4fb757b17df847e8))

## [1.8.0](https://github.com/kontourai/ui/compare/v1.7.0...v1.8.0) (2026-06-28)


### Features

* **skeleton:** add a Skeleton loading-placeholder primitive ([#29](https://github.com/kontourai/ui/issues/29)) ([71b61ea](https://github.com/kontourai/ui/commit/71b61ea37984abb75f0f83c6904307ec376c41b2))

## [1.7.0](https://github.com/kontourai/ui/compare/v1.6.0...v1.7.0) (2026-06-28)


### Features

* **empty:** accept a ReactNode description ([#27](https://github.com/kontourai/ui/issues/27)) ([87e4fdd](https://github.com/kontourai/ui/commit/87e4fdd1349b68abd1382d32a78c54b8019544f7))

## [1.6.0](https://github.com/kontourai/ui/compare/v1.5.0...v1.6.0) (2026-06-28)


### Features

* **empty:** add an icon slot and a compact variant ([#25](https://github.com/kontourai/ui/issues/25)) ([141c2fd](https://github.com/kontourai/ui/commit/141c2fddc0258e5f82849d63f5508afd29a113be))

## [1.5.0](https://github.com/kontourai/ui/compare/v1.4.1...v1.5.0) (2026-06-28)


### Features

* **empty:** add a prominent (centered, framed) variant ([#23](https://github.com/kontourai/ui/issues/23)) ([dc2bd5b](https://github.com/kontourai/ui/commit/dc2bd5beb0839e08f392860d0c0700e73a75619f))

## [1.4.1](https://github.com/kontourai/ui/compare/v1.4.0...v1.4.1) (2026-06-28)


### Fixes

* **tokens:** accessible light-mode brand teal ([#21](https://github.com/kontourai/ui/issues/21)) ([5a34246](https://github.com/kontourai/ui/commit/5a34246004eda31e7e20080fbc2c2896540624e6))

## [1.4.0](https://github.com/kontourai/ui/compare/v1.3.0...v1.4.0) (2026-06-27)


### Features

* **statusbar:** add a thin bottom status-bar primitive ([#19](https://github.com/kontourai/ui/issues/19)) ([04a4fd4](https://github.com/kontourai/ui/commit/04a4fd4b2c45853d69f3d03da62cbc9c0ed7945f))

## [1.3.0](https://github.com/kontourai/ui/compare/v1.2.0...v1.3.0) (2026-06-27)


### Features

* **empty:** support description + call-to-action ([#17](https://github.com/kontourai/ui/issues/17)) ([7670e91](https://github.com/kontourai/ui/commit/7670e913179a0aff67a18231d2c5d06372d9386e))

## [1.2.0](https://github.com/kontourai/ui/compare/v1.1.1...v1.2.0) (2026-06-27)


### Features

* **tokens:** add layered overlay elevation + tight desktop radii ([#15](https://github.com/kontourai/ui/issues/15)) ([614806e](https://github.com/kontourai/ui/commit/614806e55322b5a1116d4b719f808c935932687b))

## [1.1.1](https://github.com/kontourai/ui/compare/v1.1.0...v1.1.1) (2026-06-27)


### Fixes

* **styles:** status badge tone color clobbered by source order ([#13](https://github.com/kontourai/ui/issues/13)) ([53015b0](https://github.com/kontourai/ui/commit/53015b046cb3e4d6eea888f6faa05ab2f68cb71e))
