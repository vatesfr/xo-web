> This file contains all changes that have not been released yet.
>
> Keep in mind the changelog is addressed to **users** and should be
> understandable by them.

### Breaking changes

- `xo-server` requires Node 8.

### Enhancements

> Users must be able to say: “Nice enhancement, I'm eager to test it”

- [Hub] Ability to select SR in hub VM installation (PR [#4571](https://github.com/vatesfr/xen-orchestra/pull/4571))

### Bug fixes

> Users must be able to say: “I had this issue, happy to know it's fixed”

- [SR] Fix `[object HTMLInputElement]` name after re-attaching a SR [#4546](https://github.com/vatesfr/xen-orchestra/issues/4546) (PR [#4550](https://github.com/vatesfr/xen-orchestra/pull/4550))
- [Patches] Better error handling when fetching missing patches (PR [#4519](https://github.com/vatesfr/xen-orchestra/pull/4519))

### Released packages

> Packages will be released in the order they are here, therefore, they should
> be listed by inverse order of dependency.
>
> Rule of thumb: add packages on top.

- xo-server-sdn-controller v0.3.1
- xo-server v5.51.0
- xo-web v5.51.0

### Dropped packages

- xo-server-cloud : this package was useless for OpenSource installations because it required a complete XOA environment
