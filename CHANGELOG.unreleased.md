> This file contains all changes that have not been released yet.
>
> Keep in mind the changelog is addressed to **users** and should be
> understandable by them.

### Enhancements

> Users must be able to say: “Nice enhancement, I'm eager to test it”

- [VM] Move boot order setting from Disk tab to Advanced tab [#1523](https://github.com/vatesfr/xen-orchestra/issues/1523#issuecomment-563141573) (PR [#4975](https://github.com/vatesfr/xen-orchestra/pull/4975))
- [XOA/licenses] Display proxy licenses (PR [#4944](https://github.com/vatesfr/xen-orchestra/pull/4944))
- [Network selector] Display pool's name [#4885](https://github.com/vatesfr/xen-orchestra/issues/4885) (PR [#4990](https://github.com/vatesfr/xen-orchestra/pull/4990))

### Bug fixes

> Users must be able to say: “I had this issue, happy to know it's fixed”

- Fix mounting of NFS remote in FreeBSD (PR [#4988](https://github.com/vatesfr/xen-orchestra/issues/4988))
- [Tag] Fix 'add existing tag' in some browsers [#4960](https://github.com/vatesfr/xen-orchestra/issues/4960) (PR [#4993](https://github.com/vatesfr/xen-orchestra/pull/4993))

### Released packages

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

- @xen-orchestra/fs patch
- xo-server patch
- xo-web minor
