> This file contains all changes that have not been released yet.
>
> Keep in mind the changelog is addressed to **users** and should be
> understandable by them.

### Enhancements

> Users must be able to say: “Nice enhancement, I'm eager to test it”

- [VM/disks] Don't hide disks that are attached to the same VM twice [#4400](https://github.com/vatesfr/xen-orchestra/issues/4400) (PR [#4414](https://github.com/vatesfr/xen-orchestra/pull/4414))
- [Servers] IPv6 addresses can be used [#4520](https://github.com/vatesfr/xen-orchestra/issues/4520) (PR [#4521](https://github.com/vatesfr/xen-orchestra/pull/4521))
  Note: They must enclosed in brackets to differentiate with the port, e.g.: `[2001:db8::7334]` or `[ 2001:db8::7334]:4343`

### Bug fixes

- [Backup NG/New schedule] Properly show user errors in the form [#3831](https://github.com/vatesfr/xen-orchestra/issues/3831) (PR [#4131](https://github.com/vatesfr/xen-orchestra/pull/4131))

> Users must be able to say: “I had this issue, happy to know it's fixed”

- [VM/Advanced] Fix `"vm.set_domain_type" is not a function` error on switching virtualization mode (PV/HVM) [#4348](https://github.com/vatesfr/xen-orchestra/issues/4348) (PR [#4504](https://github.com/vatesfr/xen-orchestra/pull/4504))
- [Backup NG/logs] Show warning when zstd compression is selected but not supported [#3892](https://github.com/vatesfr/xen-orchestra/issues/3892) (PR [#4375](https://github.com/vatesfr/xen-orchestra/pull/4375)
- [Patches] Fix patches installation for CH 8.0 (PR [#4511](https://github.com/vatesfr/xen-orchestra/pull/4511))

### Released packages

> Packages will be released in the order they are here, therefore, they should
> be listed by inverse order of dependency.
>
> Rule of thumb: add packages on top.

- xo-server v5.50.0
- xo-web v5.50.0
