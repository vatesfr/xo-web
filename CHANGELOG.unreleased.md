> This file contains all changes that have not been released yet.
>
> Keep in mind the changelog is addressed to **users** and should be
> understandable by them.

### Enhancements

> Users must be able to say: “Nice enhancement, I'm eager to test it”

- [Metadata Backup] Add a warning on restoring a metadata backup (PR [#5769](https://github.com/vatesfr/xen-orchestra/pull/5769))
- [SAML] Compatible with users created with other authentication providers (PR [#5781](https://github.com/vatesfr/xen-orchestra/pull/5781))
- [Netbox] [Plugin](https://xen-orchestra.com/docs/advanced.html#netbox) to synchronize pools, VMs and IPs with [Netbox](https://netbox.readthedocs.io/en/stable/) (PR [#5783](https://github.com/vatesfr/xen-orchestra/pull/5783))

### Bug fixes

> Users must be able to say: “I had this issue, happy to know it's fixed”

- [Smart backup] Report missing pools [#2844](https://github.com/vatesfr/xen-orchestra/issues/2844) (PR [#5768](https://github.com/vatesfr/xen-orchestra/pull/5768))

### Packages to release

> Packages will be released in the order they are here, therefore, they should
> be listed by inverse order of dependency.
>
> Global order:
>
> - @vates/...
> - @xen-orchestra/...
> - xo-server-...
> - xo-server
> - xo-web
>
> The format is the following: - `$packageName` `$version`
>
> Where `$version` is
>
> - patch: if the change is a bug fix or a simple code improvement
> - minor: if the change is a new feature
> - major: if the change breaks compatibility
>
> In case of conflict, the highest (lowest in previous list) `$version` wins.

- @xen-orchestra/emit-async minor
- @xen-orchestra/defined patch
- xo-collection minor
- @xen-orchestra/log patch
- xen-api minor
- xo-server-auth-saml minor
- xo-server-backup-reports patch
- xo-server-netbox minor
- xo-web minor
- xo-server patch
