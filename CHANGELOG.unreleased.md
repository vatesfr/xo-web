> This file contains all changes that have not been released yet.
>
> Keep in mind the changelog is addressed to **users** and should be
> understandable by them.

### Enhancements

> Users must be able to say: “Nice enhancement, I'm eager to test it”

- [backup] improve merge speed after backup when using SMB3.1.1 or NFS4.2 (PR [#5481](https://github.com/vatesfr/xen-orchestra/pull/5481))
- [Task] Display age and estimated duration (PR [#5530](https://github.com/vatesfr/xen-orchestra/pull/5530))
- [Proxy] Ask for a confirmation before upgrading a proxy with running backups (PR [#5533](https://github.com/vatesfr/xen-orchestra/pull/5533))
- [Backup/restore] Allow backup restore to any licence even if XOA isn't registered (PR [#5547](https://github.com/vatesfr/xen-orchestra/pull/5547))
- [Import] Ignore case when detecting file type (PR [#5574](https://github.com/vatesfr/xen-orchestra/pull/5574))
- [Backup] Ability to set a specific schedule to always run full backups [#5541](https://github.com/vatesfr/xen-orchestra/issues/5541) (PR [#5546](https://github.com/vatesfr/xen-orchestra/pull/5546))
- [Proxy] Log VM backup restoration (PR [#5576](https://github.com/vatesfr/xen-orchestra/pull/5576))
- [XOA] Add warning message in the menu if "XOA check" reports any problems (PR [#5534](https://github.com/vatesfr/xen-orchestra/pull/5534))

### Bug fixes

> Users must be able to say: “I had this issue, happy to know it's fixed”

- [VM/Snapshot export] Fix `Error: no available place in queue` on canceling an export via browser then starting a new one when the concurrency threshold is reached [#5535](https://github.com/vatesfr/xen-orchestra/issues/5535) (PR [#5538](https://github.com/vatesfr/xen-orchestra/pull/5538))
- [Servers] Hide pool's objects if its master is unreachable [#5475](https://github.com/vatesfr/xen-orchestra/issues/5475) (PR [#5526](https://github.com/vatesfr/xen-orchestra/pull/5526))
- [Host] Restart toolstack: fix `ECONNREFUSED` error (PR [#5553](https://github.com/vatesfr/xen-orchestra/pull/5553))
- [VM migration] Intra-pool: don't automatically select migration network if no default migration network is defined on the pool (PR [#5564](https://github.com/vatesfr/xen-orchestra/pull/5564))
- [New SR] Fix `lun.LUNid.trim is not a function` error [#5497](https://github.com/vatesfr/xen-orchestra/issues/5497) (PR [#5581](https://github.com/vatesfr/xen-orchestra/pull/5581))
- [Home/vm] Bulk intra pool migration: fix VM VDIs on a shared SR wrongly migrated to the default SR (PR [#3987](https://github.com/vatesfr/xen-orchestra/pull/3987))
- [Select] Display the option on multiple lines if needed (PR [#5580](https://github.com/vatesfr/xen-orchestra/pull/5580))

### Packages to release

> Packages will be released in the order they are here, therefore, they should
> be listed by inverse order of dependency.
>
> Rule of thumb: add packages on top.
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

- @xen-orchestra/fs minor
- vhd-lib minor
- xen-api patch
- xo-common minor
- xo-server minor
- xo-web minor
