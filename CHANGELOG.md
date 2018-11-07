# ChangeLog

## *next*

### Enhancements

- [Legacy Backup] Restore and File restore functionalities moved to the Backup NG view [#3499](https://github.com/vatesfr/xen-orchestra/issues/3499) (PR [#3610](https://github.com/vatesfr/xen-orchestra/pull/3610))
- [Backup NG logs] Display warning in case of missing VMs instead of a ghosts VMs tasks (PR [#3647](https://github.com/vatesfr/xen-orchestra/pull/3647))
- Update noVNC to 1.0.0 [3080](https://github.com/vatesfr/xen-orchestra/issues/3080) (PR [#3152](https://github.com/vatesfr/xen-orchestra/pull/3152))

### Bug fixes

- [Backup ng logs] Fix restarting VMs with concurrency issue [#3603](https://github.com/vatesfr/xen-orchestra/issues/3603) (PR [#3634](https://github.com/vatesfr/xen-orchestra/pull/3634))
- Validate modal containing a confirm text input by pressing the Enter key [#2735](https://github.com/vatesfr/xen-orchestra/issues/2735) (PR [#2890](https://github.com/vatesfr/xen-orchestra/pull/2890))
- [Patches] Bulk install correctly ignores upgrade patches on licensed hosts (PR [#3651](https://github.com/vatesfr/xen-orchestra/pull/3651))
- [Backup NG logs] Handle failed restores (PR [#3648](https://github.com/vatesfr/xen-orchestra/pull/3648))

### Released packages

- xo-server v5.30.0
- xo-web v5.30.0

## **5.28.1** (2018-11-05)

### Enhancements

- [VM] Ability to set nested virtualization in settings [#3619](https://github.com/vatesfr/xen-orchestra/issues/3619) (PR [#3625](https://github.com/vatesfr/xen-orchestra/pull/3625))

### Bug fixes

- [Backup NG] Increase timeout in stale remotes detection to limit false positives (PR [#3632](https://github.com/vatesfr/xen-orchestra/pull/3632))
- Fix re-registration issue ([4e35b19ac](https://github.com/vatesfr/xen-orchestra/commit/4e35b19ac56c60f61c0e771cde70a50402797b8a))
- [Backup NG logs] Fix started jobs filter [#3636](https://github.com/vatesfr/xen-orchestra/issues/3636) (PR [#3641](https://github.com/vatesfr/xen-orchestra/pull/3641))
- [New VM] CPU and memory user inputs were ignored since previous release [#3644](https://github.com/vatesfr/xen-orchestra/issues/3644) (PR [#3646](https://github.com/vatesfr/xen-orchestra/pull/3646))

### Released packages

- @xen-orchestra/fs v0.4.1
- xo-server v5.29.4
- xo-web v5.29.3

## **5.28.0** (2018-10-31)

### Enhancements

- [Usage Report] Add IOPS read/write/total per VM [#3309](https://github.com/vatesfr/xen-orchestra/issues/3309) (PR [#3455](https://github.com/vatesfr/xen-orchestra/pull/3455))
- [Self service] Sort resource sets by name (PR [#3507](https://github.com/vatesfr/xen-orchestra/pull/3507))
- [Usage Report] Add top 3 SRs which use the most IOPS read/write/total [#3306](https://github.com/vatesfr/xen-orchestra/issues/3306) (PR [#3508](https://github.com/vatesfr/xen-orchestra/pull/3508))
- [New VM] Display a warning when the memory is below the template memory static min [#3496](https://github.com/vatesfr/xen-orchestra/issues/3496) (PR [#3513](https://github.com/vatesfr/xen-orchestra/pull/3513))
- [Backup NG form] Add link to plugins setting [#3457](https://github.com/vatesfr/xen-orchestra/issues/3457) (PR [#3514](https://github.com/vatesfr/xen-orchestra/pull/3514))
- [Backup reports] Add job and run ID [#3488](https://github.com/vatesfr/xen-orchestra/issues/3488) (PR [#3516](https://github.com/vatesfr/xen-orchestra/pull/3516))
- [Usage Report] Add top 3 VMs which use the most IOPS read/write/total [#3308](https://github.com/vatesfr/xen-orchestra/issues/3308) (PR [#3463](https://github.com/vatesfr/xen-orchestra/pull/3463))
- [Settings/logs] Homogenize action buttons in table and enable bulk deletion [#3179](https://github.com/vatesfr/xen-orchestra/issues/3179) (PR [#3528](https://github.com/vatesfr/xen-orchestra/pull/3528))
- [Settings/acls] Add bulk deletion [#3179](https://github.com/vatesfr/xen-orchestra/issues/3179) (PR [#3536](https://github.com/vatesfr/xen-orchestra/pull/3536))
- [Home] Improve search usage: raw numbers also match in names [#2906](https://github.com/vatesfr/xen-orchestra/issues/2906) (PR [#3552](https://github.com/vatesfr/xen-orchestra/pull/3552))
- [Backup NG] Timeout of a job is now in hours [#3550](https://github.com/vatesfr/xen-orchestra/issues/3550) (PR [#3553](https://github.com/vatesfr/xen-orchestra/pull/3553))
- [Backup NG] Explicit error if a VM is missing [#3434](https://github.com/vatesfr/xen-orchestra/issues/3434) (PR [#3522](https://github.com/vatesfr/xen-orchestra/pull/3522))
- [Backup NG] Show all advanced settings with non-default values in overview [#3549](https://github.com/vatesfr/xen-orchestra/issues/3549) (PR [#3554](https://github.com/vatesfr/xen-orchestra/pull/3554))
- [Backup NG] Collapse advanced settings by default [#3551](https://github.com/vatesfr/xen-orchestra/issues/3551) (PR [#3559](https://github.com/vatesfr/xen-orchestra/pull/3559))
- [Scheduling] Merge selection and interval tabs [#1902](https://github.com/vatesfr/xen-orchestra/issues/1902) (PR [#3519](https://github.com/vatesfr/xen-orchestra/pull/3519))
- [Backup NG/Restore] The backup selector now also shows the job name [#3366](https://github.com/vatesfr/xen-orchestra/issues/3366) (PR [#3564](https://github.com/vatesfr/xen-orchestra/pull/3564))
- Sort buttons by criticality in tables [#3168](https://github.com/vatesfr/xen-orchestra/issues/3168) (PR [#3545](https://github.com/vatesfr/xen-orchestra/pull/3545))
- [Usage Report] Ability to send a daily report [#3544](https://github.com/vatesfr/xen-orchestra/issues/3544) (PR [#3582](https://github.com/vatesfr/xen-orchestra/pull/3582))
- [Backup NG logs] Disable state filters with no entries [#3438](https://github.com/vatesfr/xen-orchestra/issues/3438) (PR [#3442](https://github.com/vatesfr/xen-orchestra/pull/3442))
- [ACLs] Global performance improvement on UI for non-admin users [#3578](https://github.com/vatesfr/xen-orchestra/issues/3578) (PR [#3584](https://github.com/vatesfr/xen-orchestra/pull/3584))
- [Backup NG] Improve the Schedule's view (Replace table by list) [#3491](https://github.com/vatesfr/xen-orchestra/issues/3491) (PR [#3586](https://github.com/vatesfr/xen-orchestra/pull/3586))
- ([Host/Storage], [Sr/hosts]) add bulk deletion [#3179](https://github.com/vatesfr/xen-orchestra/issues/3179) (PR [#3539](https://github.com/vatesfr/xen-orchestra/pull/3539))
- [xo-server] Use @xen-orchestra/log for basic logging [#3555](https://github.com/vatesfr/xen-orchestra/issues/3555) (PR [#3579](https://github.com/vatesfr/xen-orchestra/pull/3579))
- [Backup Report] Log error when job failed [#3458](https://github.com/vatesfr/xen-orchestra/issues/3458) (PR [#3593](https://github.com/vatesfr/xen-orchestra/pull/3593))
- [Backup NG] Display logs for backup restoration [#2511](https://github.com/vatesfr/xen-orchestra/issues/2511) (PR [#3609](https://github.com/vatesfr/xen-orchestra/pull/3609))
- [XOA] Display product version and list of all installed packages [#3560](https://github.com/vatesfr/xen-orchestra/issues/3560) (PR [#3621](https://github.com/vatesfr/xen-orchestra/pull/3621))

### Bug fixes

- [Remotes] Fix removal of broken remotes [#3327](https://github.com/vatesfr/xen-orchestra/issues/3327) (PR [#3521](https://github.com/vatesfr/xen-orchestra/pull/3521))
- [Backups] Fix stuck backups due to broken NFS remotes [#3467](https://github.com/vatesfr/xen-orchestra/issues/3467) (PR [#3534](https://github.com/vatesfr/xen-orchestra/pull/3534))
- [New VM] Fix missing cloud config when creating multiple VMs at once in some cases [#3532](https://github.com/vatesfr/xen-orchestra/issues/3532) (PR [#3535](https://github.com/vatesfr/xen-orchestra/pull/3535))
- [VM] Fix an error when an admin tried to add a disk on a Self VM whose resource set had been deleted [#2814](https://github.com/vatesfr/xen-orchestra/issues/2814) (PR [#3530](https://github.com/vatesfr/xen-orchestra/pull/3530))
- [Self/Create VM] Fix some quotas based on the template instead of the user inputs [#2683](https://github.com/vatesfr/xen-orchestra/issues/2683) (PR [#3546](https://github.com/vatesfr/xen-orchestra/pull/3546))
- [Self] Ignore DR and CR VMs when computing quotas [#3064](https://github.com/vatesfr/xen-orchestra/issues/3064) (PR [#3561](https://github.com/vatesfr/xen-orchestra/pull/3561))
- [Patches] Wrongly requiring to eject CDs from halted VMs and snapshots before installing patches (PR [#3611](https://github.com/vatesfr/xen-orchestra/pull/3611))
- [Jobs] Ensure the scheduling is not interrupted in rare cases (PR [#3617](https://github.com/vatesfr/xen-orchestra/pull/3617))
- [Home] Fix `server.getAll` error at login when user is not admin [#2335](https://github.com/vatesfr/xen-orchestra/issues/2335) (PR [#3613](https://github.com/vatesfr/xen-orchestra/pull/3613))

### Released packages

- xo-server-backup-reports v0.15.0
- xo-common v0.1.2
- @xen-orchestra/log v0.1.0
- @xen-orchestra/fs v0.4.0
- complex-matcher v0.5.0
- vhd-lib v0.4.0
- xen-api v0.20.0
- xo-server-usage-report v0.7.0
- xo-server v5.29.0
- xo-web v5.29.0

## **5.27.2** (2018-10-05)

### Enhancements

- [Host/Networks] Remove "Add network" button [#3386](https://github.com/vatesfr/xen-orchestra/issues/3386) (PR [#3478](https://github.com/vatesfr/xen-orchestra/pull/3478))
- [Host/networks] Private networks table [#3387](https://github.com/vatesfr/xen-orchestra/issues/3387) (PR [#3481](https://github.com/vatesfr/xen-orchestra/pull/3481))
- [Home/pool] Patch count pill now shows the number of unique patches in the pool [#3321](https://github.com/vatesfr/xen-orchestra/issues/3321) (PR [#3483](https://github.com/vatesfr/xen-orchestra/pull/3483))
- [Patches] Pre-install checks to avoid errors [#3252](https://github.com/vatesfr/xen-orchestra/issues/3252) (PR [#3484](https://github.com/vatesfr/xen-orchestra/pull/3484))
- [Vm/Snapshots] Allow VM operators to create snapshots and delete those they created [#3443](https://github.com/vatesfr/xen-orchestra/issues/3443) (PR [#3482](https://github.com/vatesfr/xen-orchestra/pull/3482))
- [VM/clone] Handle ACLs and Self Service [#3139](https://github.com/vatesfr/xen-orchestra/issues/3139) (PR [#3493](https://github.com/vatesfr/xen-orchestra/pull/3493))

### Bug fixes

- [Backup NG] Fix `Cannot read property 'uuid' of undefined` when a disk is removed from a VM to backup (PR [#3479](https://github.com/vatesfr/xen-orchestra/pull/3479))
- [Backup NG] Fix unexpected full after failure, interruption or basic rolling snapshot (PR [#3485](https://github.com/vatesfr/xen-orchestra/pull/3485))
- [Usage report] Display top 3 used SRs instead of top 3 biggest SRs [#3307](https://github.com/vatesfr/xen-orchestra/issues/3307) (PR [#3475](https://github.com/vatesfr/xen-orchestra/pull/3475))

### Released packages

- vhd-lib v0.3.2
- xo-vmdk-to-vhd v0.1.5
- xo-server-usage-report v0.6.0
- xo-acl-resolver v0.3.0
- xo-server v5.28.0
- xo-web v5.28.0

## **5.27.1** (2018-09-28)

### Enhancements

### Bug fixes

- [OVA Import] Allow import of files bigger than 127GB (PR [#3451](https://github.com/vatesfr/xen-orchestra/pull/3451))
- [File restore] Fix a path issue when going back to the parent folder (PR [#3446](https://github.com/vatesfr/xen-orchestra/pull/3446))
- [File restore] Fix a minor issue when showing which selected files are redundant (PR [#3447](https://github.com/vatesfr/xen-orchestra/pull/3447))
- [Memory] Fix a major leak [#2580](https://github.com/vatesfr/xen-orchestra/issues/2580) [#2820](https://github.com/vatesfr/xen-orchestra/issues/2820) (PR [#3453](https://github.com/vatesfr/xen-orchestra/pull/3453))
- [NFS Remotes] Fix `already mounted` race condition [#3380](https://github.com/vatesfr/xen-orchestra/issues/3380) (PR [#3460](https://github.com/vatesfr/xen-orchestra/pull/3460))
- Fix `Cannot read property 'type' of undefined` when deleting a VM (PR [#3465](https://github.com/vatesfr/xen-orchestra/pull/3465))

### Released packages

- @xen-orchestra/fs v0.3.1
- vhd-lib v0.3.1
- xo-vmdk-to-vhd v0.1.4
- xo-server v5.27.2
- xo-web v5.27.1

## **5.27.0** (2018-09-24)

### Enhancements

- [Remotes] Test the remote automatically on changes [#3323](https://github.com/vatesfr/xen-orchestra/issues/3323) (PR [#3397](https://github.com/vatesfr/xen-orchestra/pull/3397))
- [Remotes] Use *WORKGROUP* as default domain for new SMB remote (PR [#3398](https://github.com/vatesfr/xen-orchestra/pull/3398))
- [Backup NG form] Display a tip to encourage users to create vms on a thin-provisioned storage [#3334](https://github.com/vatesfr/xen-orchestra/issues/3334) (PR [#3402](https://github.com/vatesfr/xen-orchestra/pull/3402))
- [Backup NG form] improve schedule's form [#3138](https://github.com/vatesfr/xen-orchestra/issues/3138) (PR [#3359](https://github.com/vatesfr/xen-orchestra/pull/3359))
- [Backup NG Overview] Display transferred and merged data size for backup jobs [#3340](https://github.com/vatesfr/xen-orchestra/issues/3340) (PR [#3408](https://github.com/vatesfr/xen-orchestra/pull/3408))
- [VM] Display the PVHVM status [#3014](https://github.com/vatesfr/xen-orchestra/issues/3014) (PR [#3418](https://github.com/vatesfr/xen-orchestra/pull/3418))
- [Backup reports] Ability to test the plugin (PR [#3421](https://github.com/vatesfr/xen-orchestra/pull/3421))
- [Backup NG] Ability to restart failed VMs' backup [#3339](https://github.com/vatesfr/xen-orchestra/issues/3339) (PR [#3420](https://github.com/vatesfr/xen-orchestra/pull/3420))
- [VM] Ability to change the NIC type [#3423](https://github.com/vatesfr/xen-orchestra/issues/3423) (PR [#3440](https://github.com/vatesfr/xen-orchestra/pull/3440))
- [Backup NG Overview] Display the schedule's name [#3444](https://github.com/vatesfr/xen-orchestra/issues/3444) (PR [#3445](https://github.com/vatesfr/xen-orchestra/pull/3445))

### Bug fixes

- [Remotes] Rename connect(ed)/disconnect(ed) to enable(d)/disable(d) [#3323](https://github.com/vatesfr/xen-orchestra/issues/3323) (PR [#3396](https://github.com/vatesfr/xen-orchestra/pull/3396))
- [Remotes] Fix error appears twice on testing (PR [#3399](https://github.com/vatesfr/xen-orchestra/pull/3399))
- [Backup NG] Don't fail on VMs with empty VBDs (like CDs or floppy disks) (PR [#3410](https://github.com/vatesfr/xen-orchestra/pull/3410))
- [XOA updater] Fix issue where trial request would fail [#3407](https://github.com/vatesfr/xen-orchestra/issues/3407) (PR [#3412](https://github.com/vatesfr/xen-orchestra/pull/3412))
- [Backup NG logs] Fix log's value not being updated in the copy and report button [#3273](https://github.com/vatesfr/xen-orchestra/issues/3273) (PR [#3360](https://github.com/vatesfr/xen-orchestra/pull/3360))
- [Backup NG] Fix issue when *Delete first* was enabled for some of the remotes [#3424](https://github.com/vatesfr/xen-orchestra/issues/3424) (PR [#3427](https://github.com/vatesfr/xen-orchestra/pull/3427))
- [VM/host consoles] Work around a XenServer/XCP-ng issue which lead to some consoles not working [#3432](https://github.com/vatesfr/xen-orchestra/issues/3432) (PR [#3435](https://github.com/vatesfr/xen-orchestra/pull/3435))
- [Backup NG] Remove extraneous snapshots in case of multiple schedules [#3132](https://github.com/vatesfr/xen-orchestra/issues/3132) (PR [#3439](https://github.com/vatesfr/xen-orchestra/pull/3439))
- [Backup NG] Fix page reloaded on creating a schedule [#3461](https://github.com/vatesfr/xen-orchestra/issues/3461) (PR [#3462](https://github.com/vatesfr/xen-orchestra/pull/3462))

### Released packages

- xo-server-backup-reports v0.14.0
- @xen-orchestra/async-map v0.0.0
- @xen-orchestra/defined v0.0.0
- @xen-orchestra/emit-async v0.0.0
- @xen-orchestra/mixin v0.0.0
- xo-server v5.27.0
- xo-web v5.27.0

## **5.26.0** (2018-09-07)

### Enhancements

- [Backup (file) restore] Order backups by date in selector [#3294](https://github.com/vatesfr/xen-orchestra/issues/3294) (PR [#3374](https://github.com/vatesfr/xen-orchestra/pull/3374))
- [Self] Hide Tasks entry in menu for self users [#3311](https://github.com/vatesfr/xen-orchestra/issues/3311) (PR [#3373](https://github.com/vatesfr/xen-orchestra/pull/3373))
- [Tasks] Show previous tasks [#3266](https://github.com/vatesfr/xen-orchestra/issues/3266) (PR [#3377](https://github.com/vatesfr/xen-orchestra/pull/3377))
- [Backup NG] Add job name in names of replicated VMs (PR [#3379](https://github.com/vatesfr/xen-orchestra/pull/3379))
- [Backup NG] Restore directories [#1924](https://github.com/vatesfr/xen-orchestra/issues/1924) (PR [#3384](https://github.com/vatesfr/xen-orchestra/pull/3384))
- [VM] Start a VM on a specific host [#3191](https://github.com/vatesfr/xen-orchestra/issues/3191) (PR [#3389](https://github.com/vatesfr/xen-orchestra/pull/3389))

### Bug fixes

- [Self] Fix Self Service quotas not being correctly updated when deleting multiple VMs at a time (PR [#3368](https://github.com/vatesfr/xen-orchestra/pull/3368))
- [Backup NG] Don't fail listing backups when a remote is broken [#3365](https://github.com/vatesfr/xen-orchestra/issues/3365) (PR [#3367](https://github.com/vatesfr/xen-orchestra/pull/3367))
- [New XOSAN] Fix error sometimes occurring when selecting the pool (PR [#3370](https://github.com/vatesfr/xen-orchestra/pull/3370))
- [New VM] Selecting multiple VMs and clicking Create then Cancel used to redirect to Home [#3268](https://github.com/vatesfr/xen-orchestra/issues/3268) (PR [#3371](https://github.com/vatesfr/xen-orchestra/pull/3371))
- [Remotes] `cannot read 'properties' of undefined` error (PR [#3382](https://github.com/vatesfr/xen-orchestra/pull/3382))
- [Servers] Various issues when adding a new server [#3385](https://github.com/vatesfr/xen-orchestra/issues/3385) (PR [#3388](https://github.com/vatesfr/xen-orchestra/pull/3388))
- [Backup NG] Always delete the correct old replications [#3391](https://github.com/vatesfr/xen-orchestra/issues/3391) (PR [#3394](https://github.com/vatesfr/xen-orchestra/pull/3394))

### Released packages

- xo-server v5.26.0
- xo-web v5.26.0

## **5.25.2** (2018-08-27)

### Enhancements

### Bug fixes

- [Remotes] Fix "undefined" mount option issue [#3361](https://github.com/vatesfr/xen-orchestra/issues/3361) (PR [#3363](https://github.com/vatesfr/xen-orchestra/pull/3363))
- [Continuous Replication] Don't try to import/export VDIs on halted host [#3354](https://github.com/vatesfr/xen-orchestra/issues/3354) (PR [#3355](https://github.com/vatesfr/xen-orchestra/pull/3355))
- [Disaster Recovery] Don't try to import/export VMs on halted host (PR [#3364](https://github.com/vatesfr/xen-orchestra/pull/3364))
- [Backup NG] A successful backup job reported as Interrupted [#3018](https://github.com/vatesfr/xen-orchestra/issues/3018) (PR [#3238](https://github.com/vatesfr/xen-orchestra/pull/3238))

### Released packages

- xo-server v5.25.2
- xo-web v5.25.1

## **5.25.0** (2018-08-23)

### Enhancements

- [Tables] Filter input now always shows up even if the table is empty [#3295](https://github.com/vatesfr/xen-orchestra/issues/3295) (PR [#3296](https://github.com/vatesfr/xen-orchestra/pull/3296))
- [Tasks] The table is now still shown when there are no tasks (PR [#3305](https://github.com/vatesfr/xen-orchestra/pull/3305))
- [Host / Logs] Homogenize action buttons in table and enable bulk deletion [#3179](https://github.com/vatesfr/xen-orchestra/issues/3179) (PR [#3313](https://github.com/vatesfr/xen-orchestra/pull/3313))
- [VM/Advanced] Change "Convert" to "Convert to template" and always show the button [#3201](https://github.com/vatesfr/xen-orchestra/issues/3201) (PR [#3319](https://github.com/vatesfr/xen-orchestra/pull/3319))
- [Backup NG form] Display a tip when doing a CR on a thick-provisioned SR [#3291](https://github.com/vatesfr/xen-orchestra/issues/3291) (PR [#3333](https://github.com/vatesfr/xen-orchestra/pull/3333))
- [SR/new] Add local ext SR type [#3332](https://github.com/vatesfr/xen-orchestra/issues/3332) (PR [#3335](https://github.com/vatesfr/xen-orchestra/pull/3335))
- [Backup reports] Send report for the interrupted backup jobs on the server startup [#2998](https://github.com/vatesfr/xen-orchestra/issues/#2998) (PR [3164](https://github.com/vatesfr/xen-orchestra/pull/3164) [3154](https://github.com/vatesfr/xen-orchestra/pull/3154))
- [Backup NG form] Move VMs' selection to a dedicated card [#2711](https://github.com/vatesfr/xen-orchestra/issues/2711) (PR [#3338](https://github.com/vatesfr/xen-orchestra/pull/3338))
- [Backup NG smart mode] Exclude replicated VMs [#2338](https://github.com/vatesfr/xen-orchestra/issues/2338) (PR [#3312](https://github.com/vatesfr/xen-orchestra/pull/3312))
- [Backup NG form] Show the compression checkbox when the full mode is active [#3236](https://github.com/vatesfr/xen-orchestra/issues/3236) (PR [#3345](https://github.com/vatesfr/xen-orchestra/pull/3345))
- [New VM] Display an error when the getting of the coreOS default template fails [#3227](https://github.com/vatesfr/xen-orchestra/issues/3227) (PR [#3343](https://github.com/vatesfr/xen-orchestra/pull/3343))
- [Backup NG form] Set default retention to 1 [#3134](https://github.com/vatesfr/xen-orchestra/issues/3134) (PR [#3290](https://github.com/vatesfr/xen-orchestra/pull/3290))
- [Backup NG] New logs are searchable by job name [#3272](https://github.com/vatesfr/xen-orchestra/issues/3272) (PR [#3351](https://github.com/vatesfr/xen-orchestra/pull/3351))
- [Remotes] Add a field for NFS remotes to set mount options [#1793](https://github.com/vatesfr/xen-orchestra/issues/1793) (PR [#3353](https://github.com/vatesfr/xen-orchestra/pull/3353))

### Bug fixes

- [Backup NG form] Fix schedule's name overridden with undefined if it's not been edited [#3286](https://github.com/vatesfr/xen-orchestra/issues/3286) (PR [#3288](https://github.com/vatesfr/xen-orchestra/pull/3288))
- [Remotes] Don't change `enabled` state on errors (PR [#3318](https://github.com/vatesfr/xen-orchestra/pull/3318))
- [Remotes] Auto-reconnect on use if necessary [#2852](https://github.com/vatesfr/xen-orchestra/issues/2852) (PR [#3320](https://github.com/vatesfr/xen-orchestra/pull/3320))
- [XO items' select] Fix adding or removing a XO item from a select make the missing XO items disappear [#3322](https://github.com/vatesfr/xen-orchestra/issues/3322) (PR [#3315](https://github.com/vatesfr/xen-orchestra/pull/3315))
- [New VM / Self] Filter out SRs that are not in the template's pool [#3068](https://github.com/vatesfr/xen-orchestra/issues/3068) (PR [#3070](https://github.com/vatesfr/xen-orchestra/pull/3070))
- [New VM / Self] Fix 'unknown item' displayed in SR selector [#3267](https://github.com/vatesfr/xen-orchestra/issues/3267) (PR [#3070](https://github.com/vatesfr/xen-orchestra/pull/3070))

### Released packages

- xo-server-backup-reports v0.13.0
- @xen-orchestra/fs 0.3.0
- xo-server v5.25.0
- xo-web v5.25.0

## **5.24.0** (2018-08-09)

### Enhancements

- [Remotes] Make SMB subfolder field optional [#3249](https://github.com/vatesfr/xen-orchestra/issues/3249) (PR [#3250](https://github.com/vatesfr/xen-orchestra/pull/3250))
- [Backup NG form] Make the smart mode's toggle more visible [#2711](https://github.com/vatesfr/xen-orchestra/issues/2711) (PR [#3263](https://github.com/vatesfr/xen-orchestra/pull/3263))
- Move the copy clipboard of the VM's UUID to the header [#3221](https://github.com/vatesfr/xen-orchestra/issues/3221) (PR [#3248](https://github.com/vatesfr/xen-orchestra/pull/3248))
- [Health / Orphaned VMs] Homogenize action buttons in table and enable bulk deletion [#3179](https://github.com/vatesfr/xen-orchestra/issues/3179) (PR [#3274](https://github.com/vatesfr/xen-orchestra/pull/3274))
- [Health / Orphaned snapshot VDIs] Homogenize action buttons in table and enable bulk deletion [#3179](https://github.com/vatesfr/xen-orchestra/issues/3179) (PR [#3270](https://github.com/vatesfr/xen-orchestra/pull/3270))
- [Health / Alarms] Homogenize action buttons in table and enable bulk deletion [#3179](https://github.com/vatesfr/xen-orchestra/issues/3179) (PR [#3271](https://github.com/vatesfr/xen-orchestra/pull/3271))
- [Backup NG Overview] List the Backup NG job's modes [#3169](https://github.com/vatesfr/xen-orchestra/issues/3169) (PR [#3277](https://github.com/vatesfr/xen-orchestra/pull/3277))
- [Backup NG form] Move "Use compression" checkbox in the advanced settings [#2711](https://github.com/vatesfr/xen-orchestra/issues/2711) (PR [#3281](https://github.com/vatesfr/xen-orchestra/pull/3281))
- [Backup NG form] Ability to remove previous backups first before backup the VMs [#3212](https://github.com/vatesfr/xen-orchestra/issues/3212) (PR [#3260](https://github.com/vatesfr/xen-orchestra/pull/3260))
- [Patching] Check date consistency before patching to avoid error on install [#3056](https://github.com/vatesfr/xen-orchestra/issues/3056)

### Bug fixes

- [Pools] Filter GPU groups by pool [#3176](https://github.com/vatesfr/xen-orchestra/issues/3176) (PR [#3253](https://github.com/vatesfr/xen-orchestra/pull/3253))
- [Backup NG] Fix delta backups with SMB remotes [#3224](https://github.com/vatesfr/xen-orchestra/issues/3224) (PR [#3278](https://github.com/vatesfr/xen-orchestra/pull/3278))
- Fix VM restoration getting stuck on local SRs [#3245](https://github.com/vatesfr/xen-orchestra/issues/3245) (PR [#3243](https://github.com/vatesfr/xen-orchestra/pull/3243))

### Released packages

- xen-api v0.17.0
- @xen-orchestra/fs 0.2.1
- xo-server v5.24.0
- xo-web v5.24.0

## **5.23.0** (2018-07-26)

### Enhancements

- Export VDI content [#2432](https://github.com/vatesfr/xen-orchestra/issues/2432) (PR [#3194](https://github.com/vatesfr/xen-orchestra/pull/3194))
- Search syntax support wildcard (`*`) and regular expressions [#3190](https://github.com/vatesfr/xen-orchestra/issues/3190) (PRs [#3198](https://github.com/vatesfr/xen-orchestra/pull/3198) & [#3199](https://github.com/vatesfr/xen-orchestra/pull/3199))
- Import VDI content [#2432](https://github.com/vatesfr/xen-orchestra/issues/2432) (PR [#3216](https://github.com/vatesfr/xen-orchestra/pull/3216))
- [Backup NG form] Ability to edit a schedule's name [#2711](https://github.com/vatesfr/xen-orchestra/issues/2711) [#3071](https://github.com/vatesfr/xen-orchestra/issues/3071) (PR [#3143](https://github.com/vatesfr/xen-orchestra/pull/3143))
- [Remotes] Ability to change the type of a remote [#2423](https://github.com/vatesfr/xen-orchestra/issues/2423) (PR [#3207](https://github.com/vatesfr/xen-orchestra/pull/3207))
- [Backup NG new] Ability to set a job's timeout [#2978](https://github.com/vatesfr/xen-orchestra/issues/2978) (PR [#3222](https://github.com/vatesfr/xen-orchestra/pull/3222))
- [Remotes] Ability to edit/delete a remote with an invalid URL [#3182](https://github.com/vatesfr/xen-orchestra/issues/3182) (PR [#3226](https://github.com/vatesfr/xen-orchestra/pull/3226))
- [Backup NG logs] Prevent user from deleting logs to help resolving issues [#3153](https://github.com/vatesfr/xen-orchestra/issues/3153) (PR [#3235](https://github.com/vatesfr/xen-orchestra/pull/3235))

### Bug fixes

- [Backup Reports] Report not sent if reportWhen failure and at least a VM is successfull [#3181](https://github.com/vatesfr/xen-orchestra/issues/3181) (PR [#3185](https://github.com/vatesfr/xen-orchestra/pull/3185))
- [Backup NG] Correctly migrate report setting from legacy jobs [#3180](https://github.com/vatesfr/xen-orchestra/issues/3180) (PR [#3206](https://github.com/vatesfr/xen-orchestra/pull/3206))
- [Backup NG] remove incomplete XVA files [#3159](https://github.com/vatesfr/xen-orchestra/issues/3159) (PR [#3215](https://github.com/vatesfr/xen-orchestra/pull/3215))
- [Backup NG form] Ability to edit a schedule's state [#3223](https://github.com/vatesfr/xen-orchestra/issues/3223) (PR [#3228](https://github.com/vatesfr/xen-orchestra/pull/3228))

### Released packages

- xo-remote-parser v0.5.0
- complex-matcher v0.4.0
- xo-server-backup-reports v0.12.3
- xo-server v5.23.0
- xo-web v5.23.0

## **5.22.1** (2018-07-13)

### Bug fixes

- [Remote select] Gracefully ignore remotes with invalid URL (PR [#3178](https://github.com/vatesfr/xen-orchestra/pull/3178))

### Released packages

- xo-web v5.22.1

## **5.22.0** (2018-07-12)

### Enhancements

- [Backup NG form] Add a link to the remotes' settings [#2711](https://github.com/vatesfr/xen-orchestra/issues/2711) [#3106](https://github.com/vatesfr/xen-orchestra/issues/3106) [#2299](https://github.com/vatesfr/xen-orchestra/issues/2299) (PR [#3128](https://github.com/vatesfr/xen-orchestra/pull/3128))
- [Backup NG logs] Make copy to clipboard and report buttons always available [#3130](https://github.com/vatesfr/xen-orchestra/issues/3130) (PR [#3133](https://github.com/vatesfr/xen-orchestra/pull/3133))
- Warning message when creating a local remote [#3105](https://github.com/vatesfr/xen-orchestra/issues/3105) (PR [3142](https://github.com/vatesfr/xen-orchestra/pull/3142))
- [Remotes] Allow optional port for NFS remote [2299](https://github.com/vatesfr/xen-orchestra/issues/2299) (PR [#3131](https://github.com/vatesfr/xen-orchestra/pull/3131))
- [Backup NG form] Add offline snapshot info (PR [#3144](https://github.com/vatesfr/xen-orchestra/pull/3144))
- [Backup NG overview] Display concurrency and offline snapshot value [3087](https://github.com/vatesfr/xen-orchestra/issues/3087) (PR [3145](https://github.com/vatesfr/xen-orchestra/pull/3145))
- [VM revert] notify the result of reverting a VM [3095](https://github.com/vatesfr/xen-orchestra/issues/3095) (PR [3150](https://github.com/vatesfr/xen-orchestra/pull/3150))
- [Backup NG logs] Link XO items in the details modal [#2711](https://github.com/vatesfr/xen-orchestra/issues/2711) (PR [#3171](https://github.com/vatesfr/xen-orchestra/pull/3171))
- [VM/Snapshots] Add fast clone option when creating a VM [#3120](https://github.com/vatesfr/xen-orchestra/issues/3120) (PR [#3136](https://github.com/vatesfr/xen-orchestra/pull/3136))
- Add the Turkish translation (PR [#3174](https://github.com/vatesfr/xen-orchestra/pull/3174) [#2870](https://github.com/vatesfr/xen-orchestra/pull/2870) [#2871](https://github.com/vatesfr/xen-orchestra/pull/2871))

### Bug fixes

- Delete schedules with their job [#3108](https://github.com/vatesfr/xen-orchestra/issues/3108) (PR [3124](https://github.com/vatesfr/xen-orchestra/pull/3124))
- Remote creation: correctly reset form [#3140](https://github.com/vatesfr/xen-orchestra/issues/3140) (PR [3141](https://github.com/vatesfr/xen-orchestra/pull/3141))
- Make cloud config templates available for all users [3147](https://github.com/vatesfr/xen-orchestra/issues/3147) (PR [3148](https://github.com/vatesfr/xen-orchestra/pull/3148))
- [New VM] Only create the cloud config drive when its option is enabled [3161](https://github.com/vatesfr/xen-orchestra/issues/3161) (PR [3162](https://github.com/vatesfr/xen-orchestra/pull/3162))
- Fix error when installing patches from the host or without a default SR (PR [3166](https://github.com/vatesfr/xen-orchestra/pull/3166))
- [Backup NG] Fix SMB *Not implemented* issue [#3149](](https://github.com/vatesfr/xen-orchestra/issues/3149) (PR [3175](https://github.com/vatesfr/xen-orchestra/pull/3175))

### Released packages

- xo-remote-parser 0.4.0
- @xen-orchestra/fs 0.2.0
- vhd-lib 0.3.0
- vhd-cli 0.1.0
- xo-server v5.22.0
- xo-web v5.22.0

## **5.21.0** (2018-06-28)

### Enhancements

- Hide legacy backup creation view [#2956](https://github.com/vatesfr/xen-orchestra/issues/2956)
- [Delta Backup NG logs] Display wether the export is a full or a delta [#2711](https://github.com/vatesfr/xen-orchestra/issues/2711)
- Copy VDIs' UUID from SR/disks view [#3051](https://github.com/vatesfr/xen-orchestra/issues/3051)
- [Backup NG] New option to shutdown VMs before snapshotting them [#3058](https://github.com/vatesfr/xen-orchestra/issues/3058#event-1673756438)
- [Backup NG form] Improve feedback [#2711](https://github.com/vatesfr/xen-orchestra/issues/2711)
- [Backup NG] Different retentions for backup and replication [#2895](https://github.com/vatesfr/xen-orchestra/issues/2895)
- Possibility to use a fast clone when creating a VM from a snapshot [#2937](https://github.com/vatesfr/xen-orchestra/issues/2937)
- Ability to customize cloud config templates [#2984](https://github.com/vatesfr/xen-orchestra/issues/2984)
- Add Backup deprecation message and link to Backup NG migration blog post [#3089](https://github.com/vatesfr/xen-orchestra/issues/3089)
- [Backup NG] Ability to cancel a running backup job [#3047](https://github.com/vatesfr/xen-orchestra/issues/3047)
- [Backup NG form] Ability to enable/disable a schedule [#3062](https://github.com/vatesfr/xen-orchestra/issues/3062)
- New backup/health view with non-existent backup snapshots table [#3090](https://github.com/vatesfr/xen-orchestra/issues/3090)
- Disable cancel/destroy tasks when not allowed [#3076](https://github.com/vatesfr/xen-orchestra/issues/3076)
- Default remote type is NFS [#3103](https://github.com/vatesfr/xen-orchestra/issues/3103) (PR [#3114](https://github.com/vatesfr/xen-orchestra/pull/3114))
- Add legacy backups snapshots to backup/health [#3082](https://github.com/vatesfr/xen-orchestra/issues/3082) (PR [#3111](https://github.com/vatesfr/xen-orchestra/pull/3111))
- [Backup NG logs] Add the job's name to the modal's title [#2711](https://github.com/vatesfr/xen-orchestra/issues/2711) (PR [#3115](https://github.com/vatesfr/xen-orchestra/pull/3115))
- Adding a XCP-ng host to a XS pool now fails fast [#3061](https://github.com/vatesfr/xen-orchestra/issues/3061) (PR [#3118](https://github.com/vatesfr/xen-orchestra/pull/3118))
- [Backup NG logs] Ability to report a failed job and copy its log to the clipboard [#3100](https://github.com/vatesfr/xen-orchestra/issues/3100) (PR [#3110](https://github.com/vatesfr/xen-orchestra/pull/3110))

### Bug fixes

- update the xentools search item to return the version number of installed xentools [#3015](https://github.com/vatesfr/xen-orchestra/issues/3015)
- Fix Nagios backup reports [#2991](https://github.com/vatesfr/xen-orchestra/issues/2991)
- Fix the retry of a single failed/interrupted VM backup [#2912](https://github.com/vatesfr/xen-orchestra/issues/2912#issuecomment-395480321)
- New VM with Self: filter out networks that are not in the template's pool [#3011](https://github.com/vatesfr/xen-orchestra/issues/3011)
- [Backup NG] Auto-detect when a full export is necessary.
- Fix Load Balancer [#3075](https://github.com/vatesfr/xen-orchestra/issues/3075#event-1685469551) [#3026](https://github.com/vatesfr/xen-orchestra/issues/3026)
- [SR stats] Don't scale XAPI iowait values [#2969](https://github.com/vatesfr/xen-orchestra/issues/2969)
- [Backup NG] Don't list unusable SRs for CR/DR [#3050](https://github.com/vatesfr/xen-orchestra/issues/3050)
- Fix creating VM from snapshot (PR [3117](https://github.com/vatesfr/xen-orchestra/pull/3117))

## **5.20.0** (2018-05-31)

### Enhancements

- Add VDI UUID in SR coalesce view [#2903](https://github.com/vatesfr/xen-orchestra/issues/2903)
- Create new VDI from SR view not attached to any VM [#2229](https://github.com/vatesfr/xen-orchestra/issues/2229)
- [Patches] ignore XS upgrade in missing patches counter [#2866](https://github.com/vatesfr/xen-orchestra/issues/2866)
- [Health] List VM snapshots related to non-existing backup jobs/schedules [#2828](https://github.com/vatesfr/xen-orchestra/issues/2828)

## **5.19.0** (2018-05-01)

### Enhancements

- Expose vendor device in VM advanced tab [#2883](https://github.com/vatesfr/xen-orchestra/issues/2883)
- Networks created in XO are missing the "automatic" parameter [#2818](https://github.com/vatesfr/xen-orchestra/issues/2818)
- Performance alert disk space monitoring XS [#2737](https://github.com/vatesfr/xen-orchestra/issues/2737)
- Add ability to create NFSv4 storage repository [#2706](https://github.com/vatesfr/xen-orchestra/issues/2706)
- [SortedTable] Support link actions [#2691](https://github.com/vatesfr/xen-orchestra/issues/2691)
- Additional sort option: by host name [#2680](https://github.com/vatesfr/xen-orchestra/issues/2680)
- Expose XenTools version numbers in data model and UI [#2650](https://github.com/vatesfr/xen-orchestra/issues/2650)
- RRDs stats for SR object [#2644](https://github.com/vatesfr/xen-orchestra/issues/2644)
- composite jobs [#2367](https://github.com/vatesfr/xen-orchestra/issues/2367)
- Better error message [#2344](https://github.com/vatesfr/xen-orchestra/issues/2344)
- Avoid using backup tag with special characters [#2336](https://github.com/vatesfr/xen-orchestra/issues/2336)
- Prefix/suffix for temporary files [#2333](https://github.com/vatesfr/xen-orchestra/issues/2333)
- Continuous Replication - better interface matching on destination [#2093](https://github.com/vatesfr/xen-orchestra/issues/2093)
- Creation of LVMoHBA SRs [#1992](https://github.com/vatesfr/xen-orchestra/issues/1992)
- [Delta backup] Improve restoration by creating a virtual full VHD [#1943](https://github.com/vatesfr/xen-orchestra/issues/1943)
- VM Backups should be done in a dedicated remote directory [#1752](https://github.com/vatesfr/xen-orchestra/issues/1752)
- Add Pool / SR filter in backup view [#1762](https://github.com/vatesfr/xen-orchestra/issues/1762)
- Hide/Disable upgrade button when no upgrade exists [#1594](https://github.com/vatesfr/xen-orchestra/issues/1594)
- "Upgrade" button should display "Downgrade" when trial is over [#1483](https://github.com/vatesfr/xen-orchestra/issues/1483)

### Bugs

- Allowed-ips don't works displaying index.js:1 Uncaught TypeError: (0 , z.isIp) is not a function [#2891](https://github.com/vatesfr/xen-orchestra/issues/2891)
- Error on "usage-report" [#2876](https://github.com/vatesfr/xen-orchestra/issues/2876)
- SR selection combo only listing local storage [#2875](https://github.com/vatesfr/xen-orchestra/issues/2875)
- [Backup NG - Delta] Issue while importing delta [#2857](https://github.com/vatesfr/xen-orchestra/issues/2857)
- Create New SR page broken with past commit [#2853](https://github.com/vatesfr/xen-orchestra/issues/2853)
- [Backup NG] a target should only be preset once [#2848](https://github.com/vatesfr/xen-orchestra/issues/2848)
- Auth Method iSCSI [#2835](https://github.com/vatesfr/xen-orchestra/issues/2835)
- [Backup NG] ENOENT with Delta Backup [#2833](https://github.com/vatesfr/xen-orchestra/issues/2833)
- Different backup logs [#2732](https://github.com/vatesfr/xen-orchestra/issues/2732)
- Creating network fails silently when omitting Description [#2719](https://github.com/vatesfr/xen-orchestra/issues/2719)
- Can't create ISO NFS SR via XOA [#1845](https://github.com/vatesfr/xen-orchestra/issues/1845)

## **5.18.0** (2018-03-31)

### Enhancements

- Support huge VHDs [#2785](https://github.com/vatesfr/xen-orchestra/issues/2785)
- Usage report extended usage [#2770](https://github.com/vatesfr/xen-orchestra/issues/2770)
- Improve host available RAM display [#2750](https://github.com/vatesfr/xen-orchestra/issues/2750)
- Hide IP field during VM creation if not configured [#2739](https://github.com/vatesfr/xen-orchestra/issues/2739)
- [Home] Delete VMs modal should autofocus the input field [#2736](https://github.com/vatesfr/xen-orchestra/issues/2736)
- Backup restore view load icon [#2692](https://github.com/vatesfr/xen-orchestra/issues/2692)
- Deleting default templates doesn't work [#2666](https://github.com/vatesfr/xen-orchestra/issues/2666)
- DR clean previous "failed" snapshots [#2656](https://github.com/vatesfr/xen-orchestra/issues/2656)
- [Home] Put sort criteria in URL like the filter [#2585](https://github.com/vatesfr/xen-orchestra/issues/2585)
- Allow disconnect VDI in SR disk view [#2505](https://github.com/vatesfr/xen-orchestra/issues/2505)
- Add confirmation modal for manual backup run [#2355](https://github.com/vatesfr/xen-orchestra/issues/2355)
- Multiple schedule for backup jobs [#2286](https://github.com/vatesfr/xen-orchestra/issues/2286)
- Checks before web update [#2250](https://github.com/vatesfr/xen-orchestra/issues/2250)
- Backup logs should truly reflect if the job is running [#2206](https://github.com/vatesfr/xen-orchestra/issues/2206)
- Hook/action if an export stream is cut [#1929](https://github.com/vatesfr/xen-orchestra/issues/1929)
- Backup paths should not contain tags but job ids [#1854](https://github.com/vatesfr/xen-orchestra/issues/1854)
- Add a button to delete a backup [#1751](https://github.com/vatesfr/xen-orchestra/issues/1751)
- Dashboard available for Pool and Host level  [#1631](https://github.com/vatesfr/xen-orchestra/issues/1631)
- UI Enhancement - VM list - Allways show the Toolbar  [#1581](https://github.com/vatesfr/xen-orchestra/issues/1581)
- xoa-updater --register:  unable to define proxy using the CLI [#873](https://github.com/vatesfr/xen-orchestra/issues/873)


### Bugs

- [Backup NG] CR/DR fail with multiple VMs [#2807](https://github.com/vatesfr/xen-orchestra/issues/2807)
- HTTPS Crash [#2803](https://github.com/vatesfr/xen-orchestra/issues/2803)
- Backup NG "cannot fork the stream after it has been created" [#2790](https://github.com/vatesfr/xen-orchestra/issues/2790)
- [XOSAN] Make temporary `boundObjectId` unique [#2758](https://github.com/vatesfr/xen-orchestra/issues/2758)
- First VIF ignored at VM creation [#2794](https://github.com/vatesfr/xen-orchestra/issues/2794)
- VM creation from snapshot does not work [#2748](https://github.com/vatesfr/xen-orchestra/issues/2748)
- Error: no such object with CentOS 7 template [#2747](https://github.com/vatesfr/xen-orchestra/issues/2747)
- [Tasks] Filter does not work [#2740](https://github.com/vatesfr/xen-orchestra/issues/2740)
- Pagination broken when listing pool VMs [#2730](https://github.com/vatesfr/xen-orchestra/issues/2730)
- All jobs show error icon with message "This backup's creator no longer exists" [#2728](https://github.com/vatesfr/xen-orchestra/issues/2728)
- [Basic backup] Continous Replication VM names [#2727](https://github.com/vatesfr/xen-orchestra/issues/2727)
- Continuous replication clone removed [#2724](https://github.com/vatesfr/xen-orchestra/issues/2724)
- [Backup] "See matching VMs" issue [#2704](https://github.com/vatesfr/xen-orchestra/issues/2704)
- How to exclude CR targets from a smart backup using tags? [#2613](https://github.com/vatesfr/xen-orchestra/issues/2613)
- Successful VM import reported as failed [#2056](https://github.com/vatesfr/xen-orchestra/issues/2056)
- Delta backup: issue if a disk is once again backed up [#1824](https://github.com/vatesfr/xen-orchestra/issues/1824)

## **5.17.0** (2018-03-02)

### Enhancements

- Username field labeled inconsistently [#2651](https://github.com/vatesfr/xen-orchestra/issues/2651)
- Add modal confirmation for host emergency mode [#2230](https://github.com/vatesfr/xen-orchestra/issues/2230)
- Authorize stats fetching in RO mode [#2678](https://github.com/vatesfr/xen-orchestra/issues/2678)
- Limit VM.export concurrency [#2669](https://github.com/vatesfr/xen-orchestra/issues/2669)
- Basic backup: snapshots names [#2668](https://github.com/vatesfr/xen-orchestra/issues/2668)
- Change placement of "share" button for self [#2663](https://github.com/vatesfr/xen-orchestra/issues/2663)
- Username field labeled inconsistently [#2651](https://github.com/vatesfr/xen-orchestra/issues/2651)
- Backup report for VDI chain status [#2639](https://github.com/vatesfr/xen-orchestra/issues/2639)
- [Dashboard/Health] Control domain VDIs should includes snapshots [#2634](https://github.com/vatesfr/xen-orchestra/issues/2634)
- Do not count VM-snapshot in self quota [#2626](https://github.com/vatesfr/xen-orchestra/issues/2626)
- [xo-web] Backup logs [#2618](https://github.com/vatesfr/xen-orchestra/issues/2618)
- [VM/Snapshots] grouped deletion [#2595](https://github.com/vatesfr/xen-orchestra/issues/2595)
- [Backups] add a new state for a VM: skipped [#2591](https://github.com/vatesfr/xen-orchestra/issues/2591)
- Set a self-service VM at "share" after creation [#2589](https://github.com/vatesfr/xen-orchestra/issues/2589)
- [Backup logs] Improve Unhealthy VDI Chain message [#2586](https://github.com/vatesfr/xen-orchestra/issues/2586)
- [SortedTable] Put sort criteria in URL like the filter [#2584](https://github.com/vatesfr/xen-orchestra/issues/2584)
- Cant attach XenTools on User side.  [#2503](https://github.com/vatesfr/xen-orchestra/issues/2503)
- Pool filter for health view [#2302](https://github.com/vatesfr/xen-orchestra/issues/2302)
- [Smart Backup] Improve feedback [#2253](https://github.com/vatesfr/xen-orchestra/issues/2253)
- Backup jobs stuck if no space left on NFS remote [#2116](https://github.com/vatesfr/xen-orchestra/issues/2116)
- Link between backup and XS tasks [#1193](https://github.com/vatesfr/xen-orchestra/issues/1193)
- Move delta backup grouping to server side [#1008](https://github.com/vatesfr/xen-orchestra/issues/1008)

### Bugs

- Limit VDI export concurrency [#2672](https://github.com/vatesfr/xen-orchestra/issues/2672)
- Select is broken outside dev mode [#2645](https://github.com/vatesfr/xen-orchestra/issues/2645)
- "New" XOSAN automatically register the user [#2625](https://github.com/vatesfr/xen-orchestra/issues/2625)
- [VM/Advanced] Error on resource set change should not be hidden [#2620](https://github.com/vatesfr/xen-orchestra/issues/2620)
- misspelled word [#2606](https://github.com/vatesfr/xen-orchestra/issues/2606)
- Jobs vm.revert failing all the time [#2498](https://github.com/vatesfr/xen-orchestra/issues/2498)

## **5.16.0** (2018-01-31)

### Enhancements

- Use @xen-orchestra/cron everywhere [#2616](https://github.com/vatesfr/xen-orchestra/issues/2616)
- [SortedTable] Possibility to specify grouped/individual actions together [#2596](https://github.com/vatesfr/xen-orchestra/issues/2596)
- Self-service: allow VIF create [#2593](https://github.com/vatesfr/xen-orchestra/issues/2593)
- Ghost tasks [#2579](https://github.com/vatesfr/xen-orchestra/issues/2579)
- Autopatching: ignore 7.3 update patch for 7.2 [#2564](https://github.com/vatesfr/xen-orchestra/issues/2564)
- Better Handling of suspending VMs from the Home screen [#2547](https://github.com/vatesfr/xen-orchestra/issues/2547)
- Allow deleting VMs for which `destroy` is blocked [#2525](https://github.com/vatesfr/xen-orchestra/issues/2525)
- Better confirmation on mass destructive actions [#2522](https://github.com/vatesfr/xen-orchestra/issues/2522)
- Move VM In to/Out of Self Service Group [#1913](https://github.com/vatesfr/xen-orchestra/issues/1913)
- Two factor auth [#1897](https://github.com/vatesfr/xen-orchestra/issues/1897)
- token.create should accept an expiration [#1769](https://github.com/vatesfr/xen-orchestra/issues/1769)
- Self Service User -  User don't have quota in his dashboard [#1538](https://github.com/vatesfr/xen-orchestra/issues/1538)
- Remove CoffeeScript in xo-server [#189](https://github.com/vatesfr/xen-orchestra/issues/189)
- Better Handling of suspending VMs from the Home screen [#2547](https://github.com/vatesfr/xen-orchestra/issues/2547)
- [xen-api] Stronger reconnection policy [#2410](https://github.com/vatesfr/xen-orchestra/issues/2410)
- home view - allow selecting more than 25 items [#1210](https://github.com/vatesfr/xen-orchestra/issues/1210)
- Performances alerts [#511](https://github.com/vatesfr/xen-orchestra/issues/511)

### Bugs

- [cron] toJSDate is not a function [#2661](https://github.com/vatesfr/xen-orchestra/issues/2661)
- [Delta backup] Merge should not fail when delta contains no data [#2635](https://github.com/vatesfr/xen-orchestra/issues/2635)
- Select issues [#2590](https://github.com/vatesfr/xen-orchestra/issues/2590)
- Fix selects display [#2575](https://github.com/vatesfr/xen-orchestra/issues/2575)
- [SortedTable] Stuck when displaying last page [#2569](https://github.com/vatesfr/xen-orchestra/issues/2569)
- [vm/network] Duplicate key error [#2553](https://github.com/vatesfr/xen-orchestra/issues/2553)
- Jobs vm.revert failing all the time [#2498](https://github.com/vatesfr/xen-orchestra/issues/2498)
- TZ selector is not used for backup schedule preview [#2464](https://github.com/vatesfr/xen-orchestra/issues/2464)
- Remove filter in VM/network view [#2548](https://github.com/vatesfr/xen-orchestra/issues/2548)


## **5.15.0** (2017-12-29)

### Enhancements

- VDI resize online method removed in 7.3 [#2542](https://github.com/vatesfr/xen-orchestra/issues/2542)
- Smart replace VDI.pool_migrate removed from XenServer 7.3 Free [#2541](https://github.com/vatesfr/xen-orchestra/issues/2541)
- New memory constraints in XenServer 7.3 [#2540](https://github.com/vatesfr/xen-orchestra/issues/2540)
- Link to Settings/Logs for admins in error notifications [#2516](https://github.com/vatesfr/xen-orchestra/issues/2516)
- [Self Service] Do not use placehodlers to describe inputs  [#2509](https://github.com/vatesfr/xen-orchestra/issues/2509)
- Obfuscate password in log in LDAP plugin test [#2506](https://github.com/vatesfr/xen-orchestra/issues/2506)
- Log rotation [#2492](https://github.com/vatesfr/xen-orchestra/issues/2492)
- Continuous Replication TAG [#2473](https://github.com/vatesfr/xen-orchestra/issues/2473)
- Graphs in VM list view [#2469](https://github.com/vatesfr/xen-orchestra/issues/2469)
- [Delta Backups] Do not include merge duration in transfer speed stat [#2426](https://github.com/vatesfr/xen-orchestra/issues/2426)
- Warning for disperse mode [#2537](https://github.com/vatesfr/xen-orchestra/issues/2537)
- Select components: auto select value if only 1 choice possible [#1479](https://github.com/vatesfr/xen-orchestra/issues/1479)

### Bugs

- VM console doesn't work when using IPv6 in URL [#2530](https://github.com/vatesfr/xen-orchestra/issues/2530)
- Retention issue with failed basic backup [#2524](https://github.com/vatesfr/xen-orchestra/issues/2524)
- [VM/Advanced] Check that the autopower on setting is working [#2489](https://github.com/vatesfr/xen-orchestra/issues/2489)
- Cloud config drive create fail on XenServer < 7 [#2478](https://github.com/vatesfr/xen-orchestra/issues/2478)
- VM create fails due to missing vGPU id [#2466](https://github.com/vatesfr/xen-orchestra/issues/2466)


## **5.14.0** (2017-10-31)

### Enhancements

- VM snapshot description display [#2458](https://github.com/vatesfr/xen-orchestra/issues/2458)
- [Home] Ability to sort VM by number of snapshots [#2450](https://github.com/vatesfr/xen-orchestra/issues/2450)
- Display XS version in host view [#2439](https://github.com/vatesfr/xen-orchestra/issues/2439)
- [File restore]: Clarify the possibility to select multiple files [#2438](https://github.com/vatesfr/xen-orchestra/issues/2438)
- [Continuous Replication] Time in replicated VMs [#2431](https://github.com/vatesfr/xen-orchestra/issues/2431)
- [SortedTable] Active page in URL param [#2405](https://github.com/vatesfr/xen-orchestra/issues/2405)
- replace all '...' with the UTF-8 equivalent [#2391](https://github.com/vatesfr/xen-orchestra/issues/2391)
- [SortedTable] Explicit when no items [#2388](https://github.com/vatesfr/xen-orchestra/issues/2388)
- Handle patching licenses [#2382](https://github.com/vatesfr/xen-orchestra/issues/2382)
- Credential leaking in logs for messages regarding invalid credentials and "too fast authentication" [#2363](https://github.com/vatesfr/xen-orchestra/issues/2363)
- [SortedTable] Keyboard support [#2330](https://github.com/vatesfr/xen-orchestra/issues/2330)
- token.create should accept an expiration [#1769](https://github.com/vatesfr/xen-orchestra/issues/1769)
- On updater error, display link to documentation [#1610](https://github.com/vatesfr/xen-orchestra/issues/1610)
- Add basic vGPU support [#2413](https://github.com/vatesfr/xen-orchestra/issues/2413)
- Storage View - Disk Tab - real disk usage [#2475](https://github.com/vatesfr/xen-orchestra/issues/2475)

### Bugs

- Config drive - Custom config not working properly [#2449](https://github.com/vatesfr/xen-orchestra/issues/2449)
- Snapshot sorted table breaks copyVm [#2446](https://github.com/vatesfr/xen-orchestra/issues/2446)
- [vm/snapshots] Incorrect default sort order [#2442](https://github.com/vatesfr/xen-orchestra/issues/2442)
- [Backups/Jobs] Incorrect months mapping [#2427](https://github.com/vatesfr/xen-orchestra/issues/2427)
- [Xapi#barrier()] Not compatible with XenServer < 6.1 [#2418](https://github.com/vatesfr/xen-orchestra/issues/2418)
- [SortedTable] Change page when no more items on the page [#2401](https://github.com/vatesfr/xen-orchestra/issues/2401)
- Review and fix creating a VM from a snapshot [#2343](https://github.com/vatesfr/xen-orchestra/issues/2343)
- Unable to edit / save restored backup job [#1922](https://github.com/vatesfr/xen-orchestra/issues/1922)

## **5.13.0** (2017-09-29)

### Enhancements

- replace all '...' with the UTF-8 equivalent [#2391](https://github.com/vatesfr/xen-orchestra/issues/2391)
- [SortedTable] Explicit when no items [#2388](https://github.com/vatesfr/xen-orchestra/issues/2388)
- Auto select iqn or lun if there is only one [#2379](https://github.com/vatesfr/xen-orchestra/issues/2379)
- [Sparklines] Hide points [#2370](https://github.com/vatesfr/xen-orchestra/issues/2370)
- Allow xo-server-recover-account to generate a random password [#2360](https://github.com/vatesfr/xen-orchestra/issues/2360)
- Add disk in existing VM as self user [#2348](https://github.com/vatesfr/xen-orchestra/issues/2348)
- Sorted table for Settings/server [#2340](https://github.com/vatesfr/xen-orchestra/issues/2340)
- Sign in should be case insensitive [#2337](https://github.com/vatesfr/xen-orchestra/issues/2337)
- [SortedTable] Extend checkbox click to whole column [#2329](https://github.com/vatesfr/xen-orchestra/issues/2329)
- [SortedTable] Ability to select all items (across pages) [#2324](https://github.com/vatesfr/xen-orchestra/issues/2324)
- [SortedTable] Range selection [#2323](https://github.com/vatesfr/xen-orchestra/issues/2323)
- Warning on SMB remote creation [#2316](https://github.com/vatesfr/xen-orchestra/issues/2316)
- [Home | SortedTable] Add link to syntax doc in the filter input [#2305](https://github.com/vatesfr/xen-orchestra/issues/2305)
- [SortedTable] Add optional binding of filter to an URL query [#2301](https://github.com/vatesfr/xen-orchestra/issues/2301)
- [Home][Keyboard navigation] Allow selecting the objects [#2214](https://github.com/vatesfr/xen-orchestra/issues/2214)
- SR view / Disks: option to display non managed VDIs [#1724](https://github.com/vatesfr/xen-orchestra/issues/1724)
- Continuous Replication Retention  [#1692](https://github.com/vatesfr/xen-orchestra/issues/1692)

### Bugs

- iSCSI issue on LUN selector [#2374](https://github.com/vatesfr/xen-orchestra/issues/2374)
- Errors in VM copy are not properly reported [#2347](https://github.com/vatesfr/xen-orchestra/issues/2347)
- Removing a PIF IP fails [#2346](https://github.com/vatesfr/xen-orchestra/issues/2346)
- Review and fix creating a VM from a snapshot [#2343](https://github.com/vatesfr/xen-orchestra/issues/2343)
- iSCSI LUN Detection fails with authentification  [#2339](https://github.com/vatesfr/xen-orchestra/issues/2339)
- Fix PoolActionBar to add a new SR [#2307](https://github.com/vatesfr/xen-orchestra/issues/2307)
- [VM migration] Error if default SR not accessible to target host [#2180](https://github.com/vatesfr/xen-orchestra/issues/2180)
- A job shouldn't executable more than once at the same time [#2053](https://github.com/vatesfr/xen-orchestra/issues/2053)

## **5.12.0** (2017-08-31)

### Enhancements

- PIF selector with physical status [#2326](https://github.com/vatesfr/xen-orchestra/issues/2326)
- [SortedTable] Range selection [#2323](https://github.com/vatesfr/xen-orchestra/issues/2323)
- Self service filter for home/VM view [#2303](https://github.com/vatesfr/xen-orchestra/issues/2303)
- SR/Disks Display total of VDIs to coalesce [#2300](https://github.com/vatesfr/xen-orchestra/issues/2300)
- Pool filter in the task view [#2293](https://github.com/vatesfr/xen-orchestra/issues/2293)
- "Loading" while fetching objects [#2285](https://github.com/vatesfr/xen-orchestra/issues/2285)
- [SortedTable] Add grouped actions feature [#2276](https://github.com/vatesfr/xen-orchestra/issues/2276)
- Add a filter to the backups' log [#2246](https://github.com/vatesfr/xen-orchestra/issues/2246)
- It should not be possible to migrate a halted VM. [#2233](https://github.com/vatesfr/xen-orchestra/issues/2233)
- [Home][Keyboard navigation] Allow selecting the objects [#2214](https://github.com/vatesfr/xen-orchestra/issues/2214)
- Allow to set pool master [#2213](https://github.com/vatesfr/xen-orchestra/issues/2213)
- Continuous Replication Retention  [#1692](https://github.com/vatesfr/xen-orchestra/issues/1692)

### Bugs

- Home pagination bug [#2310](https://github.com/vatesfr/xen-orchestra/issues/2310)
- Fix PoolActionBar to add a new SR [#2307](https://github.com/vatesfr/xen-orchestra/issues/2307)
- VM snapshots are not correctly deleted [#2304](https://github.com/vatesfr/xen-orchestra/issues/2304)
- Parallel deletion of VMs fails [#2297](https://github.com/vatesfr/xen-orchestra/issues/2297)
- Continous replication create multiple zombie disks [#2292](https://github.com/vatesfr/xen-orchestra/issues/2292)
- Add user to Group issue [#2196](https://github.com/vatesfr/xen-orchestra/issues/2196)
- [VM migration] Error if default SR not accessible to target host [#2180](https://github.com/vatesfr/xen-orchestra/issues/2180)

## **5.11.0** (2017-07-31)

### Enhancements

- Storage VHD chain health [\#2178](https://github.com/vatesfr/xen-orchestra/issues/2178)

### Bug fixes

- No web VNC console [\#2258](https://github.com/vatesfr/xen-orchestra/issues/2258)
- Patching issues [\#2254](https://github.com/vatesfr/xen-orchestra/issues/2254)
- Advanced button in VM creation for self service user [\#2202](https://github.com/vatesfr/xen-orchestra/issues/2202)
- Hide "new VM" menu entry if not admin or not self service user [\#2191](https://github.com/vatesfr/xen-orchestra/issues/2191)

## **5.10.0** (2017-06-30)

### Enhancements

- Improve backup log display [\#2239](https://github.com/vatesfr/xen-orchestra/issues/2239)
- Patch SR detection improvement [\#2215](https://github.com/vatesfr/xen-orchestra/issues/2215)
- Less strict coalesce detection [\#2207](https://github.com/vatesfr/xen-orchestra/issues/2207)
- IP pool UI improvement [\#2203](https://github.com/vatesfr/xen-orchestra/issues/2203)
- Ability to clear "Auto power on" flag for DR-ed VM [\#2097](https://github.com/vatesfr/xen-orchestra/issues/2097)
- [Delta backup restoration] Choose SR for each VDIs [\#2070](https://github.com/vatesfr/xen-orchestra/issues/2070)
- Ability to forget an host (even if no longer present) [\#1934](https://github.com/vatesfr/xen-orchestra/issues/1934)

### Bug fixes

- Cross pool migrate fail [\#2248](https://github.com/vatesfr/xen-orchestra/issues/2248)
- ActionButtons with modals stay in pending state forever [\#2222](https://github.com/vatesfr/xen-orchestra/issues/2222)
- Permission issue for a user on self service VMs [\#2212](https://github.com/vatesfr/xen-orchestra/issues/2212)
- Self-Service resource loophole [\#2198](https://github.com/vatesfr/xen-orchestra/issues/2198)
- Backup log no longer shows the name of destination VM [\#2195](https://github.com/vatesfr/xen-orchestra/issues/2195)
- State not restored when exiting modal dialog [\#2194](https://github.com/vatesfr/xen-orchestra/issues/2194)
- [Xapi#exportDeltaVm] Cannot read property 'managed' of undefined [\#2189](https://github.com/vatesfr/xen-orchestra/issues/2189)
- VNC keyboard layout change [\#404](https://github.com/vatesfr/xen-orchestra/issues/404)

## **5.9.0** (2017-05-31)

### Enhancements

- Allow DR to remove previous backup first [\#2157](https://github.com/vatesfr/xen-orchestra/issues/2157)
- Feature request - add amount of RAM to memory bars [\#2149](https://github.com/vatesfr/xen-orchestra/issues/2149)
- Make the acceptability of invalid certificates configurable [\#2138](https://github.com/vatesfr/xen-orchestra/issues/2138)
- label of VM names in tasks link [\#2135](https://github.com/vatesfr/xen-orchestra/issues/2135)
- Backup report timezone [\#2133](https://github.com/vatesfr/xen-orchestra/issues/2133)
- xo-server-recover-account [\#2129](https://github.com/vatesfr/xen-orchestra/issues/2129)
- Detect disks attached to control domain [\#2126](https://github.com/vatesfr/xen-orchestra/issues/2126)
- Add task description in Tasks view [\#2125](https://github.com/vatesfr/xen-orchestra/issues/2125)
- Host reboot warning after patching for 7.1 [\#2124](https://github.com/vatesfr/xen-orchestra/issues/2124)
- Continuous Replication - possibility run VM without a clone [\#2119](https://github.com/vatesfr/xen-orchestra/issues/2119)
- Unreachable host should be detected [\#2099](https://github.com/vatesfr/xen-orchestra/issues/2099)
- Orange icon when host is is disabled [\#2098](https://github.com/vatesfr/xen-orchestra/issues/2098)
- Enhanced backup report logs [\#2096](https://github.com/vatesfr/xen-orchestra/issues/2096)
- Only show failures when configured to report on failures [\#2095](https://github.com/vatesfr/xen-orchestra/issues/2095)
- "Add all" button in self service [\#2081](https://github.com/vatesfr/xen-orchestra/issues/2081)
- Patch and pack mechanism changed on Ely [\#2058](https://github.com/vatesfr/xen-orchestra/issues/2058)
- Tip or ask people to patch from pool view [\#2057](https://github.com/vatesfr/xen-orchestra/issues/2057)
- File restore - Remind compatible backup [\#1930](https://github.com/vatesfr/xen-orchestra/issues/1930)
- Reporting for halted vm time [\#1613](https://github.com/vatesfr/xen-orchestra/issues/1613)
- Add standalone XS server to a pool and patch it to the pool level [\#878](https://github.com/vatesfr/xen-orchestra/issues/878)
- Add Cores-per-sockets [\#130](https://github.com/vatesfr/xen-orchestra/issues/130)

### Bug fixes

- VM creation is broken for non-admins [\#2168](https://github.com/vatesfr/xen-orchestra/issues/2168)
- Can't create cloud config drive [\#2162](https://github.com/vatesfr/xen-orchestra/issues/2162)
- Select is "moving" [\#2142](https://github.com/vatesfr/xen-orchestra/issues/2142)
- Select issue for affinity host [\#2141](https://github.com/vatesfr/xen-orchestra/issues/2141)
- Dashboard Storage Usage incorrect [\#2123](https://github.com/vatesfr/xen-orchestra/issues/2123)
- Detect unmerged *base copy* and prevent too long chains [\#2047](https://github.com/vatesfr/xen-orchestra/issues/2047)


## **5.8.0** (2017-04-28)

### Enhancements

- Limit About view info for non-admins [\#2109](https://github.com/vatesfr/xen-orchestra/issues/2109)
- Enabling/disabling boot device on HVM VM [\#2105](https://github.com/vatesfr/xen-orchestra/issues/2105)
- Filter: Hide snapshots in SR disk view [\#2102](https://github.com/vatesfr/xen-orchestra/issues/2102)
- Smarter XOSAN install [\#2084](https://github.com/vatesfr/xen-orchestra/issues/2084)
- PL translation [\#2079](https://github.com/vatesfr/xen-orchestra/issues/2079)
- Remove the "share this VM" option if not in self service [\#2061](https://github.com/vatesfr/xen-orchestra/issues/2061)
- "connected" status graphics are not the same on the host storage and networking tabs [\#2060](https://github.com/vatesfr/xen-orchestra/issues/2060)
- Ability to view and edit `vga` and `videoram` fields in VM view [\#158](https://github.com/vatesfr/xen-orchestra/issues/158)
- Performances [\#1](https://github.com/vatesfr/xen-api/issues/1)

### Bug fixes

- Dashboard display issues [\#2108](https://github.com/vatesfr/xen-orchestra/issues/2108)
- Dashboard CPUs Usage [\#2105](https://github.com/vatesfr/xen-orchestra/issues/2105)
- [Dashboard/Overview] Warning [\#2090](https://github.com/vatesfr/xen-orchestra/issues/2090)
- VM creation displays all networks [\#2086](https://github.com/vatesfr/xen-orchestra/issues/2086)
- Cannot change HA mode for a VM [\#2080](https://github.com/vatesfr/xen-orchestra/issues/2080)
- [Smart backup] Tags selection does not work [\#2077](https://github.com/vatesfr/xen-orchestra/issues/2077)
- [Backup jobs] Timeout should be in seconds, not milliseconds [\#2076](https://github.com/vatesfr/xen-orchestra/issues/2076)
- Missing VM templates [\#2075](https://github.com/vatesfr/xen-orchestra/issues/2075)
- [transport-email] From header not set [\#2074](https://github.com/vatesfr/xen-orchestra/issues/2074)
- Missing objects should be displayed in backup edition [\#2052](https://github.com/vatesfr/xen-orchestra/issues/2052)

## **5.7.0** (2017-03-31)

### Enhancements

- Improve ActionButton error reporting [\#2048](https://github.com/vatesfr/xen-orchestra/issues/2048)
- Home view master checkbox UI issue [\#2027](https://github.com/vatesfr/xen-orchestra/issues/2027)
- HU Translation [\#2019](https://github.com/vatesfr/xen-orchestra/issues/2019)
- [Usage report] Add name for all objects [\#2017](https://github.com/vatesfr/xen-orchestra/issues/2017)
- [Home] Improve inter-types linkage [\#2012](https://github.com/vatesfr/xen-orchestra/issues/2012)
- Remove bootable checkboxes in VM creation [\#2007](https://github.com/vatesfr/xen-orchestra/issues/2007)
- Do not display bootable toggles for disks of non-PV VMs [\#1996](https://github.com/vatesfr/xen-orchestra/issues/1996)
- Try to match network VLAN for VM migration modal [\#1990](https://github.com/vatesfr/xen-orchestra/issues/1990)
- [Usage reports] Add VM names in addition to UUIDs [\#1984](https://github.com/vatesfr/xen-orchestra/issues/1984)
- Host affinity in "advanced" VM creation [\#1983](https://github.com/vatesfr/xen-orchestra/issues/1983)
- Add job tag in backup logs [\#1982](https://github.com/vatesfr/xen-orchestra/issues/1982)
- Possibility to add a label/description to servers [\#1965](https://github.com/vatesfr/xen-orchestra/issues/1965)
- Possibility to create shared VM in a resource set [\#1964](https://github.com/vatesfr/xen-orchestra/issues/1964)
- Clearer display of disabled (backup) jobs [\#1958](https://github.com/vatesfr/xen-orchestra/issues/1958)
- Job should have a configurable timeout [\#1956](https://github.com/vatesfr/xen-orchestra/issues/1956)
- Sort failed VMs in backup report [\#1950](https://github.com/vatesfr/xen-orchestra/issues/1950)
- Support for UNIX socket path [\#1944](https://github.com/vatesfr/xen-orchestra/issues/1944)
- Interface - Host Patching - Button Verbiage [\#1911](https://github.com/vatesfr/xen-orchestra/issues/1911)
- Display if a VM is in Self Service (and which group) [\#1905](https://github.com/vatesfr/xen-orchestra/issues/1905)
- Install supplemental pack on a whole pool [\#1896](https://github.com/vatesfr/xen-orchestra/issues/1896)
- Allow VM snapshots with ACLs [\#1865](https://github.com/vatesfr/xen-orchestra/issues/1886)
- Icon to indicate if a snapshot is quiesce [\#1858](https://github.com/vatesfr/xen-orchestra/issues/1858)
- Pool Ips input too permissive [\#1731](https://github.com/vatesfr/xen-orchestra/issues/1731)
- Select is going on top after each choice [\#1359](https://github.com/vatesfr/xen-orchestra/issues/1359)

### Bug fixes

- Missing objects should be displayed in backup edition [\#2052](https://github.com/vatesfr/xen-orchestra/issues/2052)
- Search bar content changes while typing [\#2035](https://github.com/vatesfr/xen-orchestra/issues/2035)
- VM.$guest_metrics.PV_drivers_up_to_date is deprecated in XS 7.1 [\#2024](https://github.com/vatesfr/xen-orchestra/issues/2024)
- Bootable flag selection checkbox for extra disk not fetched [\#1994](https://github.com/vatesfr/xen-orchestra/issues/1994)
- Home view − Changing type must reset paging [\#1993](https://github.com/vatesfr/xen-orchestra/issues/1993)
- XOSAN menu item should only be displayed to admins [\#1968](https://github.com/vatesfr/xen-orchestra/issues/1968)
- Object type change are not correctly handled in UI [\#1967](https://github.com/vatesfr/xen-orchestra/issues/1967)
- VM creation is stuck when using ISO/DVD as install method [\#1966](https://github.com/vatesfr/xen-orchestra/issues/1966)
- Install pack on whole pool fails [\#1957](https://github.com/vatesfr/xen-orchestra/issues/1957)
- Consoles are broken in next-release [\#1954](https://github.com/vatesfr/xen-orchestra/issues/1954)
- [VHD merge] Increase BAT when necessary [\#1939](https://github.com/vatesfr/xen-orchestra/issues/1939)
- Issue on VM restore time [\#1936](https://github.com/vatesfr/xen-orchestra/issues/1936)
- Two remotes should not be able to have the same name [\#1879](https://github.com/vatesfr/xen-orchestra/issues/1879)
- Selfservice limits not honored after VM creation [\#1695](https://github.com/vatesfr/xen-orchestra/issues/1695)

## **5.6.0** (2017-01-27)

Reporting, LVM File level restore.

### Enhancements

- Do not stop patches install if already applied [\#1904](https://github.com/vatesfr/xen-orchestra/issues/1904)
- Improve scheduling UI [\#1893](https://github.com/vatesfr/xen-orchestra/issues/1893)
- Smart backup and tag [\#1885](https://github.com/vatesfr/xen-orchestra/issues/1885)
- Missing embeded API documention [\#1882](https://github.com/vatesfr/xen-orchestra/issues/1882)
- Add local DVD in CD selector [\#1880](https://github.com/vatesfr/xen-orchestra/issues/1880)
- File level restore for LVM [\#1878](https://github.com/vatesfr/xen-orchestra/issues/1878)
- Restore multiple files from file level restore [\#1877](https://github.com/vatesfr/xen-orchestra/issues/1877)
- Add a VM tab for host & pool views [\#1864](https://github.com/vatesfr/xen-orchestra/issues/1864)
- Icon to indicate if a snapshot is quiesce [\#1858](https://github.com/vatesfr/xen-orchestra/issues/1858)
- UI for disconnect hosts comp [\#1833](https://github.com/vatesfr/xen-orchestra/issues/1833)
- Eject all xs-guest.iso in a pool [\#1798](https://github.com/vatesfr/xen-orchestra/issues/1798)
- Display installed supplemental pack on host [\#1506](https://github.com/vatesfr/xen-orchestra/issues/1506)
- Install supplemental pack on host comp [\#1460](https://github.com/vatesfr/xen-orchestra/issues/1460)
- Pool-wide combined stats [\#1324](https://github.com/vatesfr/xen-orchestra/issues/1324)

### Bug fixes

- IP-address not released when VM removed [\#1906](https://github.com/vatesfr/xen-orchestra/issues/1906)
- Interface broken due to new Bootstrap Alpha [\#1871](https://github.com/vatesfr/xen-orchestra/issues/1871)
- Self service recompute all limits broken [\#1866](https://github.com/vatesfr/xen-orchestra/issues/1866)
- Patch not found error for XS 6.5 [\#1863](https://github.com/vatesfr/xen-orchestra/issues/1863)
- Convert To Template issues [\#1855](https://github.com/vatesfr/xen-orchestra/issues/1855)
- Removing PIF seems to fail [\#1853](https://github.com/vatesfr/xen-orchestra/issues/1853)
- Depth should be >= 1 in backup creation [\#1851](https://github.com/vatesfr/xen-orchestra/issues/1851)
- Wrong link in Dashboard > Health [\#1850](https://github.com/vatesfr/xen-orchestra/issues/1850)
- Incorrect file dates shown in new File Restore feature [\#1840](https://github.com/vatesfr/xen-orchestra/issues/1840)
- IP allocation problem [\#1747](https://github.com/vatesfr/xen-orchestra/issues/1747)
- Selfservice limits not honored after VM creation [\#1695](https://github.com/vatesfr/xen-orchestra/issues/1695)

## **5.5.0** (2016-12-20)

File level restore.

### Enhancements

- Better auto select network when migrate VM [\#1788](https://github.com/vatesfr/xen-orchestra/issues/1788)
- Plugin for passive backup job reporting in Nagios [\#1664](https://github.com/vatesfr/xen-orchestra/issues/1664)
- File level restore for delta backup [\#1590](https://github.com/vatesfr/xen-orchestra/issues/1590)
- Better select filters for ACLs [\#1515](https://github.com/vatesfr/xen-orchestra/issues/1515)
- All pools and "negative" filters [\#1503](https://github.com/vatesfr/xen-orchestra/issues/1503)
- VM copy with disk selection [\#826](https://github.com/vatesfr/xen-orchestra/issues/826)
- Disable metadata exports [\#1818](https://github.com/vatesfr/xen-orchestra/issues/1818)

### Bug fixes

- Tool small selector [\#1832](https://github.com/vatesfr/xen-orchestra/issues/1832)
- Replication does not work from a VM created by a CR or delta backup [\#1811](https://github.com/vatesfr/xen-orchestra/issues/1811)
- Can't add a SSH key in VM creation [\#1805](https://github.com/vatesfr/xen-orchestra/issues/1805)
- Issue when no default SR in a pool [\#1804](https://github.com/vatesfr/xen-orchestra/issues/1804)
- XOA doesn't refresh after an update anymore [\#1801](https://github.com/vatesfr/xen-orchestra/issues/1801)
- Shortcuts not inhibited on inputs on Safari [\#1691](https://github.com/vatesfr/xen-orchestra/issues/1691)

## **5.4.0** (2016-11-23)

### Enhancements

- XML display in alerts [\#1776](https://github.com/vatesfr/xen-orchestra/issues/1776)
- Remove some view for non admin users [\#1773](https://github.com/vatesfr/xen-orchestra/issues/1773)
- Complex matcher should support matching boolean values [\#1768](https://github.com/vatesfr/xen-orchestra/issues/1768)
- Home SR view [\#1764](https://github.com/vatesfr/xen-orchestra/issues/1764)
- Filter on tag click [\#1763](https://github.com/vatesfr/xen-orchestra/issues/1763)
- Testable plugins [\#1749](https://github.com/vatesfr/xen-orchestra/issues/1749)
- Backup/Restore Design fix. [\#1734](https://github.com/vatesfr/xen-orchestra/issues/1734)
- Display the owner of a \(backup\) job [\#1733](https://github.com/vatesfr/xen-orchestra/issues/1733)
- Use paginated table for backup jobs [\#1726](https://github.com/vatesfr/xen-orchestra/issues/1726)
- SR view / Disks: should display snapshot VDIs [\#1723](https://github.com/vatesfr/xen-orchestra/issues/1723)
- Restored VM should have an identifiable name [\#1719](https://github.com/vatesfr/xen-orchestra/issues/1719)
- If host reboot action returns NO\_HOSTS\_AVAILABLE, ask to force [\#1717](https://github.com/vatesfr/xen-orchestra/issues/1717)
- Hide xo-server timezone in backups [\#1706](https://github.com/vatesfr/xen-orchestra/issues/1706)
- Enable hyperlink for Hostname for Issues [\#1700](https://github.com/vatesfr/xen-orchestra/issues/1700)
- Pool/network - Modify column [\#1696](https://github.com/vatesfr/xen-orchestra/issues/1696)
- UI - Plugins - Display a message if no plugins [\#1670](https://github.com/vatesfr/xen-orchestra/issues/1670)
- Display warning/error for delta backup on XS older than 6.5 [\#1647](https://github.com/vatesfr/xen-orchestra/issues/1647)
- XO without internet access doesn't work [\#1629](https://github.com/vatesfr/xen-orchestra/issues/1629)
- Improve backup restore view [\#1609](https://github.com/vatesfr/xen-orchestra/issues/1609)
- UI Enhancement - Acronym for dummy [\#1604](https://github.com/vatesfr/xen-orchestra/issues/1604)
- Slack XO plugin for backup report [\#1593](https://github.com/vatesfr/xen-orchestra/issues/1593)
- Expose XAPI exceptions in the UI [\#1481](https://github.com/vatesfr/xen-orchestra/issues/1481)
- Running VMs in the host overview, all VMs in the pool overview [\#1432](https://github.com/vatesfr/xen-orchestra/issues/1432)
- Move location of NFS mount point [\#1405](https://github.com/vatesfr/xen-orchestra/issues/1405)
- Home: Pool list - additionnal informations for pool [\#1226](https://github.com/vatesfr/xen-orchestra/issues/1226)
- Modify VLAN of an existing network [\#1092](https://github.com/vatesfr/xen-orchestra/issues/1092)
- Wrong instructions for CLI upgrade [\#787](https://github.com/vatesfr/xen-orchestra/issues/787)
- Ability to export/import XO config [\#786](https://github.com/vatesfr/xen-orchestra/issues/786)
- Test button for transport-email plugin [\#697](https://github.com/vatesfr/xen-orchestra/issues/697)
- Merge `scheduler` API into `schedule` [\#664](https://github.com/vatesfr/xen-orchestra/issues/664)

### Bug fixes

- Should jobs be accessible to non admins? [\#1759](https://github.com/vatesfr/xen-orchestra/issues/1759)
- Schedules deletion is not working [\#1737](https://github.com/vatesfr/xen-orchestra/issues/1737)
- Editing a job from the jobs overview page does not work  [\#1736](https://github.com/vatesfr/xen-orchestra/issues/1736)
- Editing a schedule from jobs overview does not work  [\#1728](https://github.com/vatesfr/xen-orchestra/issues/1728)
- ACLs not correctly imported [\#1722](https://github.com/vatesfr/xen-orchestra/issues/1722)
- Some Bootstrap style broken [\#1721](https://github.com/vatesfr/xen-orchestra/issues/1721)
- Not properly sign out on auth token expiration [\#1711](https://github.com/vatesfr/xen-orchestra/issues/1711)
- Hosts/<UUID>/network status is incorrect [\#1702](https://github.com/vatesfr/xen-orchestra/issues/1702)
- Patches application fails "Found : Moved Temporarily" [\#1701](https://github.com/vatesfr/xen-orchestra/issues/1701)
- Password generation for user creation is not working [\#1678](https://github.com/vatesfr/xen-orchestra/issues/1678)
- \#/dashboard/health Remove All Orphaned VDIs  [\#1622](https://github.com/vatesfr/xen-orchestra/issues/1622)
- Create a new SR - CIFS/SAMBA Broken [\#1615](https://github.com/vatesfr/xen-orchestra/issues/1615)
- xo-cli --list-objects: truncated output ? 64k buffer limitation ? [\#1356](https://github.com/vatesfr/xen-orchestra/issues/1356)

## **5.3.0** (2016-10-20)

### Enhancements

- Missing favicon [\#1660](https://github.com/vatesfr/xen-orchestra/issues/1660)
- ipPools quota [\#1565](https://github.com/vatesfr/xen-orchestra/issues/1565)
- Dashboard - orphaned VDI [\#1654](https://github.com/vatesfr/xen-orchestra/issues/1654)
- Stats in home/host view when expanded [\#1634](https://github.com/vatesfr/xen-orchestra/issues/1634)
- Bar for used and total RAM on home pool view [\#1625](https://github.com/vatesfr/xen-orchestra/issues/1625)
- Can't translate some text [\#1624](https://github.com/vatesfr/xen-orchestra/issues/1624)
- Dynamic RAM allocation at creation time [\#1603](https://github.com/vatesfr/xen-orchestra/issues/1603)
- Display memory bar in home/host view [\#1616](https://github.com/vatesfr/xen-orchestra/issues/1616)
- Improve keyboard navigation [\#1578](https://github.com/vatesfr/xen-orchestra/issues/1578)
- Strongly suggest to install the guest tools [\#1575](https://github.com/vatesfr/xen-orchestra/issues/1575)
- Missing tooltip [\#1568](https://github.com/vatesfr/xen-orchestra/issues/1568)
- Emphasize already used ips in ipPools [\#1566](https://github.com/vatesfr/xen-orchestra/issues/1566)
- Change "missing feature message" for non-admins [\#1564](https://github.com/vatesfr/xen-orchestra/issues/1564)
- Allow VIF edition [\#1446](https://github.com/vatesfr/xen-orchestra/issues/1446)
- Disable browser autocomplete on credentials on the Update page [\#1304](https://github.com/vatesfr/xen-orchestra/issues/1304)
- keyboard shortcuts [\#1279](https://github.com/vatesfr/xen-orchestra/issues/1279)
- Add network bond creation [\#876](https://github.com/vatesfr/xen-orchestra/issues/876)
- `pool.setDefaultSr\(\)` should not require `pool` param [\#1558](https://github.com/vatesfr/xen-orchestra/issues/1558)
- Select default SR [\#1554](https://github.com/vatesfr/xen-orchestra/issues/1554)
- No error message when I exceed my resource set quota [\#1541](https://github.com/vatesfr/xen-orchestra/issues/1541)
- Hide some buttons for self service VMs [\#1539](https://github.com/vatesfr/xen-orchestra/issues/1539)
- Add Job ID to backup schedules [\#1534](https://github.com/vatesfr/xen-orchestra/issues/1534)
- Correct name for VM selector with templates [\#1530](https://github.com/vatesfr/xen-orchestra/issues/1530)
- Help text when no matches for a filter [\#1517](https://github.com/vatesfr/xen-orchestra/issues/1517)
- Icon or tooltip to allow VDI migration in VM disk view [\#1512](https://github.com/vatesfr/xen-orchestra/issues/1512)
- Create a snapshot before restoring one [\#1445](https://github.com/vatesfr/xen-orchestra/issues/1445)
- Auto power on setting at creation time [\#1444](https://github.com/vatesfr/xen-orchestra/issues/1444)
- local remotes should be avoided if possible [\#1441](https://github.com/vatesfr/xen-orchestra/issues/1441)
- Self service edition unclear [\#1429](https://github.com/vatesfr/xen-orchestra/issues/1429)
- Avoid "\_" char in job tag name [\#1414](https://github.com/vatesfr/xen-orchestra/issues/1414)
- Display message if host reboot needed to apply patches [\#1352](https://github.com/vatesfr/xen-orchestra/issues/1352)
- Color code on host PIF stats can be misleading [\#1265](https://github.com/vatesfr/xen-orchestra/issues/1265)
- Sign in page is not rendered correctly [\#1161](https://github.com/vatesfr/xen-orchestra/issues/1161)
- Template management [\#1091](https://github.com/vatesfr/xen-orchestra/issues/1091)
- On pool view: collapse network list [\#1461](https://github.com/vatesfr/xen-orchestra/issues/1461)
- Alert when trying to reboot/halt the pool master XS [\#1458](https://github.com/vatesfr/xen-orchestra/issues/1458)
- Adding tooltip on Home page [\#1456](https://github.com/vatesfr/xen-orchestra/issues/1456)
- Docker container management functionality missing from v5 [\#1442](https://github.com/vatesfr/xen-orchestra/issues/1442)
- bad error message - delete snapshot [\#1433](https://github.com/vatesfr/xen-orchestra/issues/1433)
- Create tag during VM creation [\#1431](https://github.com/vatesfr/xen-orchestra/issues/1431)

### Bug fixes

- Display issues on plugin array edition [\#1663](https://github.com/vatesfr/xen-orchestra/issues/1663)
- Import of delta backups fails [\#1656](https://github.com/vatesfr/xen-orchestra/issues/1656)
- Host - Missing IP config for PIF [\#1651](https://github.com/vatesfr/xen-orchestra/issues/1651)
- Remote copy is always activating compression [\#1645](https://github.com/vatesfr/xen-orchestra/issues/1645)
- LB plugin UI problems [\#1630](https://github.com/vatesfr/xen-orchestra/issues/1630)
- Keyboard shortcuts should not work when a modal is open [\#1589](https://github.com/vatesfr/xen-orchestra/issues/1589)
- UI small bug in drop-down lists [\#1411](https://github.com/vatesfr/xen-orchestra/issues/1411)
- md5 delta backup error [\#1672](https://github.com/vatesfr/xen-orchestra/issues/1672)
- Can't edit VIF network [\#1640](https://github.com/vatesfr/xen-orchestra/issues/1640)
- Do not expose shortcuts while console is focused [\#1614](https://github.com/vatesfr/xen-orchestra/issues/1614)
- All users can see VM templates [\#1621](https://github.com/vatesfr/xen-orchestra/issues/1621)
- Profile page is broken [\#1612](https://github.com/vatesfr/xen-orchestra/issues/1612)
- SR delete should redirect to home [\#1611](https://github.com/vatesfr/xen-orchestra/issues/1611)
- Delta VHD backup checksum is invalidated by chaining [\#1606](https://github.com/vatesfr/xen-orchestra/issues/1606)
- VM with long description break on 2 lines [\#1580](https://github.com/vatesfr/xen-orchestra/issues/1580)
- Network status on VM edition [\#1573](https://github.com/vatesfr/xen-orchestra/issues/1573)
- VM template deletion fails [\#1571](https://github.com/vatesfr/xen-orchestra/issues/1571)
- Template edition - "no such object" [\#1569](https://github.com/vatesfr/xen-orchestra/issues/1569)
- missing links / element not displayed as links [\#1567](https://github.com/vatesfr/xen-orchestra/issues/1567)
- Backup restore stalled on some SMB shares [\#1412](https://github.com/vatesfr/xen-orchestra/issues/1412)
- Wrong bond display [\#1156](https://github.com/vatesfr/xen-orchestra/issues/1156)
- Multiple reboot selection doesn't work [\#1562](https://github.com/vatesfr/xen-orchestra/issues/1562)
- Server logs should be displayed in reverse chonological order [\#1547](https://github.com/vatesfr/xen-orchestra/issues/1547)
- Cannot create resource sets without limits [\#1537](https://github.com/vatesfr/xen-orchestra/issues/1537)
- UI - Weird display when editing long VM desc [\#1528](https://github.com/vatesfr/xen-orchestra/issues/1528)
- Useless iso selector in host console [\#1527](https://github.com/vatesfr/xen-orchestra/issues/1527)
- Pool and Host dummy welcome message [\#1519](https://github.com/vatesfr/xen-orchestra/issues/1519)
- Bug on Network VM tab [\#1518](https://github.com/vatesfr/xen-orchestra/issues/1518)
- Link to home with filter in query does not work [\#1513](https://github.com/vatesfr/xen-orchestra/issues/1513)
- VHD merge fails with "RangeError: index out of range" on SMB remote [\#1511](https://github.com/vatesfr/xen-orchestra/issues/1511)
- DR: previous VDIs are not removed [\#1510](https://github.com/vatesfr/xen-orchestra/issues/1510)
- DR: previous copies not removed when same number as depth [\#1509](https://github.com/vatesfr/xen-orchestra/issues/1509)
- Empty Saved Search doesn't load when set to default filter [\#1354](https://github.com/vatesfr/xen-orchestra/issues/1354)
- Removing a user/group should delete its ACLs [\#899](https://github.com/vatesfr/xen-orchestra/issues/899)
- OVA Import - XO stuck during import [\#1551](https://github.com/vatesfr/xen-orchestra/issues/1551)
- SMB remote empty domain fails [\#1499](https://github.com/vatesfr/xen-orchestra/issues/1499)
- Can't edit a remote password [\#1498](https://github.com/vatesfr/xen-orchestra/issues/1498)
- Issue in VM create with CoreOS [\#1493](https://github.com/vatesfr/xen-orchestra/issues/1493)
- Overlapping months in backup view [\#1488](https://github.com/vatesfr/xen-orchestra/issues/1488)
- No line break for SSH key in user view [\#1475](https://github.com/vatesfr/xen-orchestra/issues/1475)
- Create VIF UI issues [\#1472](https://github.com/vatesfr/xen-orchestra/issues/1472)

## **5.2.0** (2016-09-09)

### Enhancements

- IP management [\#1350](https://github.com/vatesfr/xen-orchestra/issues/1350), [\#988](https://github.com/vatesfr/xen-orchestra/issues/988), [\#1427](https://github.com/vatesfr/xen-orchestra/issues/1427) and [\#240](https://github.com/vatesfr/xen-orchestra/issues/240)
- Update reverse proxy example [\#1474](https://github.com/vatesfr/xen-orchestra/issues/1474)
- Improve log view [\#1467](https://github.com/vatesfr/xen-orchestra/issues/1467)
- Backup Reports: e-mail subject [\#1463](https://github.com/vatesfr/xen-orchestra/issues/1463)
- Backup Reports: report the error [\#1462](https://github.com/vatesfr/xen-orchestra/issues/1462)
- Vif selector: select management network by default [\#1425](https://github.com/vatesfr/xen-orchestra/issues/1425)
- Display when browser disconnected to server [\#1417](https://github.com/vatesfr/xen-orchestra/issues/1417)
- Tooltip on OS icon in VM view [\#1416](https://github.com/vatesfr/xen-orchestra/issues/1416)
- Display pool master [\#1407](https://github.com/vatesfr/xen-orchestra/issues/1407)
- Missing tooltips in VM creation view [\#1402](https://github.com/vatesfr/xen-orchestra/issues/1402)
- Handle VBD disconnect and connect [\#1397](https://github.com/vatesfr/xen-orchestra/issues/1397)
- Eject host from a pool [\#1395](https://github.com/vatesfr/xen-orchestra/issues/1395)
- Improve pool general view [\#1393](https://github.com/vatesfr/xen-orchestra/issues/1393)
- Improve patching system [\#1392](https://github.com/vatesfr/xen-orchestra/issues/1392)
- Pool name modification [\#1390](https://github.com/vatesfr/xen-orchestra/issues/1390)
- Confirmation dialog before destroying VDIs [\#1388](https://github.com/vatesfr/xen-orchestra/issues/1388)
- Tooltips for meter object [\#1387](https://github.com/vatesfr/xen-orchestra/issues/1387)
- New Host assistant [\#1374](https://github.com/vatesfr/xen-orchestra/issues/1374)
- New VM assistant [\#1373](https://github.com/vatesfr/xen-orchestra/issues/1373)
- New SR assistant [\#1372](https://github.com/vatesfr/xen-orchestra/issues/1372)
- Direct access to VDI listing from dashboard's SR usage breakdown [\#1371](https://github.com/vatesfr/xen-orchestra/issues/1371)
- Can't set a network name at pool level [\#1368](https://github.com/vatesfr/xen-orchestra/issues/1368)
- Change a few mouse over descriptions [\#1363](https://github.com/vatesfr/xen-orchestra/issues/1363)
- Hide network install in VM create if template is HVM [\#1362](https://github.com/vatesfr/xen-orchestra/issues/1362)
- SR space left during VM creation [\#1358](https://github.com/vatesfr/xen-orchestra/issues/1358)
- Add destination SR on migration modal in VM view [\#1357](https://github.com/vatesfr/xen-orchestra/issues/1357)
- Ability to create a new VM from a snapshot [\#1353](https://github.com/vatesfr/xen-orchestra/issues/1353)
- Missing explanation/confirmation on Snapshot Page [\#1349](https://github.com/vatesfr/xen-orchestra/issues/1349)
- Log view: expose API errors in the web UI [\#1344](https://github.com/vatesfr/xen-orchestra/issues/1344)
- Registration on update page [\#1341](https://github.com/vatesfr/xen-orchestra/issues/1341)
- Add export snapshot button [\#1336](https://github.com/vatesfr/xen-orchestra/issues/1336)
- Use saved SSH keys in VM create CloudConfig [\#1319](https://github.com/vatesfr/xen-orchestra/issues/1319)
- Collapse header in console view [\#1268](https://github.com/vatesfr/xen-orchestra/issues/1268)
- Two max concurrent jobs in parallel [\#915](https://github.com/vatesfr/xen-orchestra/issues/915)
- Handle OVA import via the web UI [\#709](https://github.com/vatesfr/xen-orchestra/issues/709)

### Bug fixes

- Bug on VM console when header is hidden [\#1485](https://github.com/vatesfr/xen-orchestra/issues/1485)
- Disks not removed when deleting multiple VMs [\#1484](https://github.com/vatesfr/xen-orchestra/issues/1484)
- Do not display VDI disconnect button when a VM is not running [\#1470](https://github.com/vatesfr/xen-orchestra/issues/1470)
- Do not display VIF disconnect button when a VM is not running [\#1468](https://github.com/vatesfr/xen-orchestra/issues/1468)
- Error on migration if no default SR \(even when not used\) [\#1466](https://github.com/vatesfr/xen-orchestra/issues/1466)
- DR issue while rotating old backup [\#1464](https://github.com/vatesfr/xen-orchestra/issues/1464)
- Giving resource set to end-user ends with error [\#1448](https://github.com/vatesfr/xen-orchestra/issues/1448)
- Error thrown when cancelling out of Delete User confirmation dialog [\#1439](https://github.com/vatesfr/xen-orchestra/issues/1439)
- Wrong month label shown in Backup and Job scheduler [\#1438](https://github.com/vatesfr/xen-orchestra/issues/1438)
- Bug on Self service creation/edition [\#1428](https://github.com/vatesfr/xen-orchestra/issues/1428)
- ISO selection during VM create is not mounted after [\#1415](https://github.com/vatesfr/xen-orchestra/issues/1415)
- Hosts general view: bad link for storage [\#1408](https://github.com/vatesfr/xen-orchestra/issues/1408)
- Backup Schedule - "Month" and "Day of Week" display error [\#1404](https://github.com/vatesfr/xen-orchestra/issues/1404)
- Migrate dialog doesn't present all available VIF's in new UI interface [\#1403](https://github.com/vatesfr/xen-orchestra/issues/1403)
- NFS mount issues [\#1396](https://github.com/vatesfr/xen-orchestra/issues/1396)
- Select component color [\#1391](https://github.com/vatesfr/xen-orchestra/issues/1391)
- SR created with local path shouldn't be shared [\#1389](https://github.com/vatesfr/xen-orchestra/issues/1389)
- Disks (VBD) are attached to VM in RO mode instead of RW even if RO is unchecked [\#1386](https://github.com/vatesfr/xen-orchestra/issues/1386)
- Re-connection issues between server and XS hosts [\#1384](https://github.com/vatesfr/xen-orchestra/issues/1384)
- Meter object style with Chrome 52 [\#1383](https://github.com/vatesfr/xen-orchestra/issues/1383)
- Editing a rolling snapshot job seems to fail [\#1376](https://github.com/vatesfr/xen-orchestra/issues/1376)
- Dashboard SR usage and total inverted [\#1370](https://github.com/vatesfr/xen-orchestra/issues/1370)
- XenServer connection issue with host while using VGPUs [\#1369](https://github.com/vatesfr/xen-orchestra/issues/1369)
- Job created with v4 are not correctly displayed in v5 [\#1366](https://github.com/vatesfr/xen-orchestra/issues/1366)
- CPU accounting in resource set [\#1365](https://github.com/vatesfr/xen-orchestra/issues/1365)
- Tooltip stay displayed when a button change state [\#1360](https://github.com/vatesfr/xen-orchestra/issues/1360)
- Failure on host reboot [\#1351](https://github.com/vatesfr/xen-orchestra/issues/1351)
- Editing Backup Jobs Without Compression, Slider Always Set To On [\#1339](https://github.com/vatesfr/xen-orchestra/issues/1339)
- Month Selection on Backup Screen Wrong [\#1338](https://github.com/vatesfr/xen-orchestra/issues/1338)
- Delta backup fail when removed VDIs [\#1333](https://github.com/vatesfr/xen-orchestra/issues/1333)

## **5.1.0** (2016-07-26)

### Enhancements

- Improve backups timezone UI [\#1314](https://github.com/vatesfr/xen-orchestra/issues/1314)
- HOME view submenus [\#1306](https://github.com/vatesfr/xen-orchestra/issues/1306)
- Ability for a user to save SSH keys [\#1299](https://github.com/vatesfr/xen-orchestra/issues/1299)
- \[ACLs\] Ability to select all hosts/VMs [\#1296](https://github.com/vatesfr/xen-orchestra/issues/1296)
- Improve scheduling UI [\#1295](https://github.com/vatesfr/xen-orchestra/issues/1295)
- Plugins: Predefined configurations [\#1289](https://github.com/vatesfr/xen-orchestra/issues/1289)
- Button to recompute resource sets limits [\#1287](https://github.com/vatesfr/xen-orchestra/issues/1287)
- Credit scheduler CAP and weight configuration [\#1283](https://github.com/vatesfr/xen-orchestra/issues/1283)
- Migration form problem on the /v5/vms/\_\_UUID\_\_ page when doing xenmotion inside a pool [\#1254](https://github.com/vatesfr/xen-orchestra/issues/1254)
- /v5/\#/pools/\_\_UUID\_\_: patch table improvement  [\#1246](https://github.com/vatesfr/xen-orchestra/issues/1246)
- /v5/\#/hosts/\_\_UUID\_\_: patch list improvements ? [\#1245](https://github.com/vatesfr/xen-orchestra/issues/1245)
- F\*cking patches, how do they work? [\#1236](https://github.com/vatesfr/xen-orchestra/issues/1236)
- Change Default Filter [\#1235](https://github.com/vatesfr/xen-orchestra/issues/1235)
- Add a property on jobs to know their state [\#1232](https://github.com/vatesfr/xen-orchestra/issues/1232)
- Spanish translation [\#1231](https://github.com/vatesfr/xen-orchestra/issues/1231)
- Home: "Filter" input and keyboard focus [\#1228](https://github.com/vatesfr/xen-orchestra/issues/1228)
- Display xenserver version [\#1225](https://github.com/vatesfr/xen-orchestra/issues/1225)
- Plugin config: presets & defaults [\#1222](https://github.com/vatesfr/xen-orchestra/issues/1222)
- Allow halted VM migration [\#1216](https://github.com/vatesfr/xen-orchestra/issues/1216)
- Missing confirm dialog on critical button [\#1211](https://github.com/vatesfr/xen-orchestra/issues/1211)
- Backup logs are not sortable [\#1196](https://github.com/vatesfr/xen-orchestra/issues/1196)
- Page title with the name of current object [\#1185](https://github.com/vatesfr/xen-orchestra/issues/1185)
- Existing VIF management [\#1176](https://github.com/vatesfr/xen-orchestra/issues/1176)
- Do not display fast clone option is there isn't template disks [\#1172](https://github.com/vatesfr/xen-orchestra/issues/1172)
- UI issue when adding a user [\#1159](https://github.com/vatesfr/xen-orchestra/issues/1159)
- Combined values on stats [\#1158](https://github.com/vatesfr/xen-orchestra/issues/1158)
- Parallel coordinates graph [\#1157](https://github.com/vatesfr/xen-orchestra/issues/1157)
- VM creation on self-service as user [\#1155](https://github.com/vatesfr/xen-orchestra/issues/1155)
- VM copy bulk action on home view [\#1154](https://github.com/vatesfr/xen-orchestra/issues/1154)
- Better VDI map [\#1151](https://github.com/vatesfr/xen-orchestra/issues/1151)
- Missing tooltips on buttons [\#1150](https://github.com/vatesfr/xen-orchestra/issues/1150)
- Patching from pool view [\#1149](https://github.com/vatesfr/xen-orchestra/issues/1149)
- Missing patches in dashboard [\#1148](https://github.com/vatesfr/xen-orchestra/issues/1148)
- Improve tasks view [\#1147](https://github.com/vatesfr/xen-orchestra/issues/1147)
- Home bulk VM migration [\#1146](https://github.com/vatesfr/xen-orchestra/issues/1146)
- LDAP plugin clear password field [\#1145](https://github.com/vatesfr/xen-orchestra/issues/1145)
- Cron default behavior [\#1144](https://github.com/vatesfr/xen-orchestra/issues/1144)
- Modal for migrate on home [\#1143](https://github.com/vatesfr/xen-orchestra/issues/1143)
- /v5/\#/srs/\_\_UUID\_\_: UI improvements [\#1142](https://github.com/vatesfr/xen-orchestra/issues/1142)
- /v5/\#/pools/: some name should be links [\#1141](https://github.com/vatesfr/xen-orchestra/issues/1141)
- create the page /v5/\#/pools/ [\#1140](https://github.com/vatesfr/xen-orchestra/issues/1140)
- Dashboard: add links to different part of XOA [\#1139](https://github.com/vatesfr/xen-orchestra/issues/1139)
- /v5/\#/dashboard/overview: add link on the "Top 5 SR Usage" graph [\#1135](https://github.com/vatesfr/xen-orchestra/issues/1135)
- /v5/\#/backup/overview: display the error when there is one returned by xenserver on failed job. [\#1134](https://github.com/vatesfr/xen-orchestra/issues/1134)
- /v5/: add an option to set the number of element displayed in tables [\#1133](https://github.com/vatesfr/xen-orchestra/issues/1133)
- Updater refresh page after update [\#1131](https://github.com/vatesfr/xen-orchestra/issues/1131)
- /v5/\#/settings/plugins [\#1130](https://github.com/vatesfr/xen-orchestra/issues/1130)
- /v5/\#/new/sr: layout issue [\#1129](https://github.com/vatesfr/xen-orchestra/issues/1129)
- v5 /v5/\#/vms/new: layout issue [\#1128](https://github.com/vatesfr/xen-orchestra/issues/1128)
- v5 user page missing style [\#1127](https://github.com/vatesfr/xen-orchestra/issues/1127)
- Remote helper/tester [\#1075](https://github.com/vatesfr/xen-orchestra/issues/1075)
- Generate uiSchema from custom schema properties [\#951](https://github.com/vatesfr/xen-orchestra/issues/951)
- Customizing VM names generation during batch creation [\#949](https://github.com/vatesfr/xen-orchestra/issues/949)

### Bug fixes

- Plugins: Don't use `default` attributes in presets list [\#1288](https://github.com/vatesfr/xen-orchestra/issues/1288)
- CPU weight must be an integer [\#1286](https://github.com/vatesfr/xen-orchestra/issues/1286)
- Overview of self service is always empty [\#1282](https://github.com/vatesfr/xen-orchestra/issues/1282)
- SR attach/creation issue [\#1281](https://github.com/vatesfr/xen-orchestra/issues/1281)
- Self service resources not modified after a VM deletion [\#1276](https://github.com/vatesfr/xen-orchestra/issues/1276)
- Scheduled jobs seems use GMT since 5.0 [\#1258](https://github.com/vatesfr/xen-orchestra/issues/1258)
- Can't create a VM with disks on 2 different SRs [\#1257](https://github.com/vatesfr/xen-orchestra/issues/1257)
- Graph display bug [\#1247](https://github.com/vatesfr/xen-orchestra/issues/1247)
- /v5/#/hosts/__UUID__: Patch list not limited to the current pool [\#1244](https://github.com/vatesfr/xen-orchestra/issues/1244)
- Replication issues [\#1233](https://github.com/vatesfr/xen-orchestra/issues/1233)
- VM creation install method disabled fields [\#1198](https://github.com/vatesfr/xen-orchestra/issues/1198)
- Update icon shouldn't be displayed when menu is collapsed [\#1188](https://github.com/vatesfr/xen-orchestra/issues/1188)
- /v5/ : Load average graph axis issue [\#1167](https://github.com/vatesfr/xen-orchestra/issues/1167)
- Some remote can't be opened [\#1164](https://github.com/vatesfr/xen-orchestra/issues/1164)
- Bulk action for hosts in home and pool view [\#1153](https://github.com/vatesfr/xen-orchestra/issues/1153)
- New Vif [\#1138](https://github.com/vatesfr/xen-orchestra/issues/1138)
- Missing SRs [\#1123](https://github.com/vatesfr/xen-orchestra/issues/1123)
- Continuous replication email alert does not obey per job setting [\#1121](https://github.com/vatesfr/xen-orchestra/issues/1121)
- Safari XO5 issue [\#1120](https://github.com/vatesfr/xen-orchestra/issues/1120)
- ACLs shoud be available in Enterprise Edition [\#1118](https://github.com/vatesfr/xen-orchestra/issues/1118)
- SR edit name or description doesn't work [\#1116](https://github.com/vatesfr/xen-orchestra/issues/1116)
- Bad RRD parsing for VIFs [\#969](https://github.com/vatesfr/xen-orchestra/issues/969)

## **5.0.0** (2016-06-24)

### Enhancements

- Handle failed quiesce in snapshots [\#1088](https://github.com/vatesfr/xen-orchestra/issues/1088)
- Sparklines stats [\#1061](https://github.com/vatesfr/xen-orchestra/issues/1061)
- Task view [\#1060](https://github.com/vatesfr/xen-orchestra/issues/1060)
- Improved import system [\#1048](https://github.com/vatesfr/xen-orchestra/issues/1048)
- Backup restore view improvements [\#1021](https://github.com/vatesfr/xen-orchestra/issues/1021)
- Restore VM - Wrong VLAN on the VMs interface [\#1016](https://github.com/vatesfr/xen-orchestra/issues/1016)
- Fast Disk Cloning [\#960](https://github.com/vatesfr/xen-orchestra/issues/960)
- Disaster recovery job should target SRs, not pools [\#955](https://github.com/vatesfr/xen-orchestra/issues/955)
- Improve Header/Content interaction in a page [\#926](https://github.com/vatesfr/xen-orchestra/issues/926)
- New default view [\#912](https://github.com/vatesfr/xen-orchestra/issues/912)
- Xen Patching - Restart Pending [\#883](https://github.com/vatesfr/xen-orchestra/issues/883)
- Hide About page for user that are not admin [\#877](https://github.com/vatesfr/xen-orchestra/issues/877)
- ACL: Ability to view/sort/group by User/Group, Objects or Role [\#875](https://github.com/vatesfr/xen-orchestra/issues/875)
- ACL: Ability to select multiple users & group when creating a rule [\#874](https://github.com/vatesfr/xen-orchestra/issues/874)
- Translation [\#839](https://github.com/vatesfr/xen-orchestra/issues/839)
- XO offer useless network interfaces for XenMontion [\#833](https://github.com/vatesfr/xen-orchestra/issues/833)
- Show HVM, PVM, PVHVM modes in guest details [\#806](https://github.com/vatesfr/xen-orchestra/issues/806)
- Tree view: display cpu available/total for each host [\#696](https://github.com/vatesfr/xen-orchestra/issues/696)
- Greenkeeper integration [\#667](https://github.com/vatesfr/xen-orchestra/issues/667)
- Clarify vCPUs and RAM editor  [\#658](https://github.com/vatesfr/xen-orchestra/issues/658)
- Backup LZ4 compression [\#647](https://github.com/vatesfr/xen-orchestra/issues/647)
- Support enum in plugins configuration [\#638](https://github.com/vatesfr/xen-orchestra/issues/638)
- Add configuration option to disable xoa-updater  [\#535](https://github.com/vatesfr/xen-orchestra/issues/535)
- Use cursors to add more context to actions [\#523](https://github.com/vatesfr/xen-orchestra/issues/523)
- Review UI for flat view [\#354](https://github.com/vatesfr/xen-orchestra/issues/354)
- Review UI for the tree view [\#353](https://github.com/vatesfr/xen-orchestra/issues/353)
- Tag filtering [\#233](https://github.com/vatesfr/xen-orchestra/issues/233)
- GUI review [\#230](https://github.com/vatesfr/xen-orchestra/issues/230)
- Review UI for VM creation [\#214](https://github.com/vatesfr/xen-orchestra/issues/214)
- Ability to collapse pools/hosts in main view [\#173](https://github.com/vatesfr/xen-orchestra/issues/173)
- Issue importing .xva VM via xo-web [\#1022](https://github.com/vatesfr/xen-orchestra/issues/1022)
- Enhancement Proposal - Cancel In Progress Backups [\#1003](https://github.com/vatesfr/xen-orchestra/issues/1003)
- Can't create VM with  CloudConfigDrive [\#917](https://github.com/vatesfr/xen-orchestra/issues/917)
- Auth: LDAP User causes problems [\#893](https://github.com/vatesfr/xen-orchestra/issues/893)
- No tags in Continuous Replication [\#838](https://github.com/vatesfr/xen-orchestra/issues/838)
- Delta backup Depth not working [\#802](https://github.com/vatesfr/xen-orchestra/issues/802)
- Update Section - Running version info missing - gui enhancement [\#795](https://github.com/vatesfr/xen-orchestra/issues/795)
- On reboot, vnc console wrongly scaled [\#722](https://github.com/vatesfr/xen-orchestra/issues/722)
- Make the object name \(title\) "sticky" at the top of the page [\#705](https://github.com/vatesfr/xen-orchestra/issues/705)
- pool view: display Local SR from hosts in the current pool [\#692](https://github.com/vatesfr/xen-orchestra/issues/692)
- tree view: display all IPs [\#689](https://github.com/vatesfr/xen-orchestra/issues/689)
- XO5 parallel distribution [\#462](https://github.com/vatesfr/xen-orchestra/issues/462)
- Load balancing with XO [\#423](https://github.com/vatesfr/xen-orchestra/issues/423)

### Bug fixes

- vCPUs number when no tools installed [\#1089](https://github.com/vatesfr/xen-orchestra/issues/1089)
- Config Drive textbox disappears when content is deleted [\#1012](https://github.com/vatesfr/xen-orchestra/issues/1012)
- storage status not changed in host view page after disconnect/connect  [\#1009](https://github.com/vatesfr/xen-orchestra/issues/1009)
- Cannot Delete Logs From Backup Overview [\#1004](https://github.com/vatesfr/xen-orchestra/issues/1004)
- \[v5.x\] Plugins configuration: optional non-used objects are sent [\#1000](https://github.com/vatesfr/xen-orchestra/issues/1000)
- "@" char in remote password break the remote view [\#997](https://github.com/vatesfr/xen-orchestra/issues/997)
- Handle MEMORY\_CONSTRAINT\_VIOLATION correctly [\#970](https://github.com/vatesfr/xen-orchestra/issues/970)
- VM creation error on XenServer Dundee [\#964](https://github.com/vatesfr/xen-orchestra/issues/964)
- Copy VMs doesn't display all SRs [\#945](https://github.com/vatesfr/xen-orchestra/issues/945)
- Autopower\_on wrong value [\#937](https://github.com/vatesfr/xen-orchestra/issues/937)
- Correctly handle unknown users in group view [\#900](https://github.com/vatesfr/xen-orchestra/issues/900)
- Importing into Dundee [\#887](https://github.com/vatesfr/xen-orchestra/issues/887)
- update status - gui resize issue [\#803](https://github.com/vatesfr/xen-orchestra/issues/803)
- Backup Remote Stores Problem [\#751](https://github.com/vatesfr/xen-orchestra/issues/751)
- VM view is broken when changing a disk SR twice [\#670](https://github.com/vatesfr/xen-orchestra/issues/670)
- console mouse sync  [\#280](https://github.com/vatesfr/xen-orchestra/issues/280)

## **4.16.0** (2016-04-29)

Maintenance release

### Enhancements

- TOO\_MANY\_PENDING\_TASKS [\#861](https://github.com/vatesfr/xen-orchestra/issues/861)

### Bug fixes

- Incorrect VM target name with continuous replication [\#904](https://github.com/vatesfr/xen-orchestra/issues/904)
- Error while deleting users [\#901](https://github.com/vatesfr/xen-orchestra/issues/901)
- Use an available path to the SR to create a config drive [\#882](https://github.com/vatesfr/xen-orchestra/issues/882)
- VM autoboot don't set the right pool parameter [\#879](https://github.com/vatesfr/xen-orchestra/issues/879)
- BUG: ACL with NFS ISO Library not working! [\#870](https://github.com/vatesfr/xen-orchestra/issues/870)
- Broken paths in backups in SMB [\#865](https://github.com/vatesfr/xen-orchestra/issues/865)
- Plugins page loads users/groups multiple times [\#829](https://github.com/vatesfr/xen-orchestra/issues/829)
- "Ghost" VM remains after migration [\#769](https://github.com/vatesfr/xen-orchestra/issues/769)

## **4.15.0** (2016-03-21)

Load balancing, SMB delta support, advanced network operations...

### Enhancements

- Add the job name inside the backup email report [\#819](https://github.com/vatesfr/xen-orchestra/issues/819)
- Delta backup with quiesce [\#812](https://github.com/vatesfr/xen-orchestra/issues/812)
- Hosts: No user feedback when error occurs with SR connect / disconnect [\#810](https://github.com/vatesfr/xen-orchestra/issues/810)
- Expose components versions [\#807](https://github.com/vatesfr/xen-orchestra/issues/807)
- Rework networks/PIFs management [\#805](https://github.com/vatesfr/xen-orchestra/issues/805)
- Displaying all SRs and a list of available hosts for creating VM from a pool [\#790](https://github.com/vatesfr/xen-orchestra/issues/790)
- Add "Source network" on "VM migration" screen [\#785](https://github.com/vatesfr/xen-orchestra/issues/785)
- Migration queue [\#783](https://github.com/vatesfr/xen-orchestra/issues/783)
- Match network names for VM migration [\#782](https://github.com/vatesfr/xen-orchestra/issues/782)
- Disk names [\#780](https://github.com/vatesfr/xen-orchestra/issues/780)
- Self service: should the user be able to set the CPU weight? [\#767](https://github.com/vatesfr/xen-orchestra/issues/767)
- host & pool Citrix license status [\#763](https://github.com/vatesfr/xen-orchestra/issues/763)
- pool view: Provide "updates" section [\#762](https://github.com/vatesfr/xen-orchestra/issues/762)
- XOA ISO image: ambigious root disk label [\#761](https://github.com/vatesfr/xen-orchestra/issues/761)
- Host info: provide system serial number [\#760](https://github.com/vatesfr/xen-orchestra/issues/760)
- CIFS ISO SR Creation [\#731](https://github.com/vatesfr/xen-orchestra/issues/731)
- MAC address not preserved on VM restore [\#707](https://github.com/vatesfr/xen-orchestra/issues/707)
- Failing replication job should send reports [\#659](https://github.com/vatesfr/xen-orchestra/issues/659)
- Display networks in the Pool view [\#226](https://github.com/vatesfr/xen-orchestra/issues/226)

### Bug fixes

- Broken link to backup remote  [\#821](https://github.com/vatesfr/xen-orchestra/issues/821)
- Issue with self-signed cert for email plugin [\#817](https://github.com/vatesfr/xen-orchestra/issues/817)
- Plugins view, reset form and errors [\#815](https://github.com/vatesfr/xen-orchestra/issues/815)
- HVM recovery mode is broken [\#794](https://github.com/vatesfr/xen-orchestra/issues/794)
- Disk bug when creating vm from template [\#778](https://github.com/vatesfr/xen-orchestra/issues/778)
- Can't mount NFS shares in remote stores [\#775](https://github.com/vatesfr/xen-orchestra/issues/775)
- VM disk name and description not passed during creation [\#774](https://github.com/vatesfr/xen-orchestra/issues/774)
- NFS mount problem for Windows share [\#771](https://github.com/vatesfr/xen-orchestra/issues/771)
- lodash.pluck not installed [\#757](https://github.com/vatesfr/xen-orchestra/issues/757)
- this.\_getAuthenticationTokensForUser is not a function [\#755](https://github.com/vatesfr/xen-orchestra/issues/755)
- CentOS 6.x 64bit template creates a VM that won't boot [\#733](https://github.com/vatesfr/xen-orchestra/issues/733)
- Lot of xo:perf leading to XO crash [\#575](https://github.com/vatesfr/xen-orchestra/issues/575)
- New collection checklist [\#262](https://github.com/vatesfr/xen-orchestra/issues/262)

## **4.14.0** (2016-02-23)

Self service, custom CloudInit...

### Enhancements

- VM creation self service with quotas [\#285](https://github.com/vatesfr/xen-orchestra/issues/285)
- Cloud config custom user data [\#706](https://github.com/vatesfr/xen-orchestra/issues/706)
- Patches behind a proxy [\#737](https://github.com/vatesfr/xen-orchestra/issues/737)
- Remote store status indicator [\#728](https://github.com/vatesfr/xen-orchestra/issues/728)
- Patch list order [\#724](https://github.com/vatesfr/xen-orchestra/issues/724)
- Enable reporting on additional backup types [\#717](https://github.com/vatesfr/xen-orchestra/issues/717)
- Tooltip name for cancel [\#703](https://github.com/vatesfr/xen-orchestra/issues/703)
- Portable VHD merging [\#646](https://github.com/vatesfr/xen-orchestra/issues/646)

### Bug fixes

- Avoid merge between two delta vdi backups [\#702](https://github.com/vatesfr/xen-orchestra/issues/702)
- Text in table is not cut anymore [\#713](https://github.com/vatesfr/xen-orchestra/issues/713)
- Disk size edition issue with float numbers [\#719](https://github.com/vatesfr/xen-orchestra/issues/719)
- Create vm, summary is not refreshed [\#721](https://github.com/vatesfr/xen-orchestra/issues/721)
- Boot order problem [\#726](https://github.com/vatesfr/xen-orchestra/issues/726)

## **4.13.0** (2016-02-05)

Backup checksum, SMB remotes...

### Enhancements

- Add SMB mount for remote [\#338](https://github.com/vatesfr/xen-orchestra/issues/338)
- Centralize Perm in a lib [\#345](https://github.com/vatesfr/xen-orchestra/issues/345)
- Expose interpool migration details [\#567](https://github.com/vatesfr/xen-orchestra/issues/567)
- Add checksum for delta backup [\#617](https://github.com/vatesfr/xen-orchestra/issues/617)
- Redirect from HTTP to HTTPS [\#626](https://github.com/vatesfr/xen-orchestra/issues/626)
- Expose vCPU weight [\#633](https://github.com/vatesfr/xen-orchestra/issues/633)
- Avoid metadata in delta backup [\#651](https://github.com/vatesfr/xen-orchestra/issues/651)
- Button to clear logs [\#661](https://github.com/vatesfr/xen-orchestra/issues/661)
- Units for RAM and disks [\#666](https://github.com/vatesfr/xen-orchestra/issues/666)
- Remove multiple VDIs at once [\#676](https://github.com/vatesfr/xen-orchestra/issues/676)
- Find orphaned VDI snapshots [\#679](https://github.com/vatesfr/xen-orchestra/issues/679)
- New health view in Dashboard [\#680](https://github.com/vatesfr/xen-orchestra/issues/680)
- Use physical usage for VDI and SR [\#682](https://github.com/vatesfr/xen-orchestra/issues/682)
- TLS configuration [\#685](https://github.com/vatesfr/xen-orchestra/issues/685)
- Better VM info on tree view [\#688](https://github.com/vatesfr/xen-orchestra/issues/688)
- Absolute values in tooltips for tree view [\#690](https://github.com/vatesfr/xen-orchestra/issues/690)
- Absolute values for host memory [\#691](https://github.com/vatesfr/xen-orchestra/issues/691)

### Bug fixes

- Issues on host console screen [\#672](https://github.com/vatesfr/xen-orchestra/issues/672)
- NFS remote mount fails in particular case [\#665](https://github.com/vatesfr/xen-orchestra/issues/665)
- Unresponsive pages [\#662](https://github.com/vatesfr/xen-orchestra/issues/662)
- Live migration fail in the same pool with local SR fails [\#655](https://github.com/vatesfr/xen-orchestra/issues/655)

## **4.12.0** (2016-01-18)

Continuous Replication, Continuous Delta backup...

### Enhancements

- Continuous VM replication [\#582](https://github.com/vatesfr/xen-orchestra/issues/582)
- Continuous Delta Backup [\#576](https://github.com/vatesfr/xen-orchestra/issues/576)
- Scheduler should not run job again if previous instance is not finished [\#642](https://github.com/vatesfr/xen-orchestra/issues/642)
- Boot VM automatically after creation [\#635](https://github.com/vatesfr/xen-orchestra/issues/635)
- Manage existing VIFs in templates [\#630](https://github.com/vatesfr/xen-orchestra/issues/630)
- Support templates with existing install repository [\#627](https://github.com/vatesfr/xen-orchestra/issues/627)
- Remove running VMs [\#616](https://github.com/vatesfr/xen-orchestra/issues/616)
- Prevent a VM to start before delta import is finished [\#613](https://github.com/vatesfr/xen-orchestra/issues/613)
- Spawn multiple VMs at once [\#606](https://github.com/vatesfr/xen-orchestra/issues/606)
- Fixed `suspendVM` in tree view. [\#619](https://github.com/vatesfr/xen-orchestra/pull/619) ([pdonias](https://github.com/pdonias))

### Bug fixes

- User defined MAC address is not fetch in VM install [\#643](https://github.com/vatesfr/xen-orchestra/issues/643)
- CoreOsCloudConfig is not shown with CoreOS [\#639](https://github.com/vatesfr/xen-orchestra/issues/639)
- Plugin activation/deactivation in web UI seems broken [\#637](https://github.com/vatesfr/xen-orchestra/issues/637)
- Issue when creating CloudConfig drive [\#636](https://github.com/vatesfr/xen-orchestra/issues/636)
- CloudConfig hostname shouldn't have space [\#634](https://github.com/vatesfr/xen-orchestra/issues/634)
- Cloned VIFs are not properly deleted on VM creation [\#632](https://github.com/vatesfr/xen-orchestra/issues/632)
- Default PV args missing during VM creation [\#628](https://github.com/vatesfr/xen-orchestra/issues/628)
- VM creation problems from custom templates [\#625](https://github.com/vatesfr/xen-orchestra/issues/625)
- Emergency shutdown race condition [\#622](https://github.com/vatesfr/xen-orchestra/issues/622)
- `vm.delete\(\)` should not delete VDIs attached to other VMs [\#621](https://github.com/vatesfr/xen-orchestra/issues/621)
- VM creation error from template with a disk [\#581](https://github.com/vatesfr/xen-orchestra/issues/581)
- Only delete VDI exports when VM backup is successful [\#644](https://github.com/vatesfr/xen-orchestra/issues/644)
- Change the name of an imported VM during the import process [\#641](https://github.com/vatesfr/xen-orchestra/issues/641)
- Creating a new VIF in view is partially broken [\#652](https://github.com/vatesfr/xen-orchestra/issues/652)
- Grey out the "create button" during VM creation [\#654](https://github.com/vatesfr/xen-orchestra/issues/654)

## **4.11.0** (2015-12-22)

Delta backup, CloudInit...

### Enhancements

- Visible list of SR inside a VM [\#601](https://github.com/vatesfr/xen-orchestra/issues/601)
- VDI move [\#591](https://github.com/vatesfr/xen-orchestra/issues/591)
- Edit pre-existing disk configuration during VM creation [\#589](https://github.com/vatesfr/xen-orchestra/issues/589)
- Allow disk size edition [\#587](https://github.com/vatesfr/xen-orchestra/issues/587)
- Better VDI resize support [\#585](https://github.com/vatesfr/xen-orchestra/issues/585)
- Remove manual VM export metadata in UI [\#580](https://github.com/vatesfr/xen-orchestra/issues/580)
- Support import VM metadata [\#579](https://github.com/vatesfr/xen-orchestra/issues/579)
- Set a default pool SR [\#572](https://github.com/vatesfr/xen-orchestra/issues/572)
- ISOs should be sorted by name [\#565](https://github.com/vatesfr/xen-orchestra/issues/565)
- Button to boot a VM from a disc once [\#564](https://github.com/vatesfr/xen-orchestra/issues/564)
- Ability to boot a PV VM from a disc [\#563](https://github.com/vatesfr/xen-orchestra/issues/563)
- Add an option to manually run backup jobs [\#562](https://github.com/vatesfr/xen-orchestra/issues/562)
- backups to unmounted storage [\#561](https://github.com/vatesfr/xen-orchestra/issues/561)
- Root integer properties cannot be edited in plugins configuration form [\#550](https://github.com/vatesfr/xen-orchestra/issues/550)
- Generic CloudConfig drive [\#549](https://github.com/vatesfr/xen-orchestra/issues/549)
- Auto-discovery of installed xo-server plugins [\#546](https://github.com/vatesfr/xen-orchestra/issues/546)
- Hide info on flat view [\#545](https://github.com/vatesfr/xen-orchestra/issues/545)
- Config plugin boolean properties must have a default value \(undefined prohibited\) [\#543](https://github.com/vatesfr/xen-orchestra/issues/543)
- Present detailed errors on plugin configuration failures [\#530](https://github.com/vatesfr/xen-orchestra/issues/530)
- Do not reset form on failures in plugins configuration [\#529](https://github.com/vatesfr/xen-orchestra/issues/529)
- XMPP alert plugin [\#518](https://github.com/vatesfr/xen-orchestra/issues/518)
- Hide tag adders depending on ACLs [\#516](https://github.com/vatesfr/xen-orchestra/issues/516)
- Choosing a framework for xo-web 5 [\#514](https://github.com/vatesfr/xen-orchestra/issues/514)
- Prevent adding a host in an existing XAPI connection [\#466](https://github.com/vatesfr/xen-orchestra/issues/466)
- Read only connection to Xen servers/pools [\#439](https://github.com/vatesfr/xen-orchestra/issues/439)
- generic notification system [\#391](https://github.com/vatesfr/xen-orchestra/issues/391)
- Data architecture review [\#384](https://github.com/vatesfr/xen-orchestra/issues/384)
- Make filtering easier to understand/add some "default" filters [\#207](https://github.com/vatesfr/xen-orchestra/issues/207)
- Improve performance [\#148](https://github.com/vatesfr/xen-orchestra/issues/148)

### Bug fixes

- VM metadata export should not require a snapshot [\#615](https://github.com/vatesfr/xen-orchestra/issues/615)
- Missing patch for all hosts is continuously refreshed [\#609](https://github.com/vatesfr/xen-orchestra/issues/609)
- Backup import memory issue [\#608](https://github.com/vatesfr/xen-orchestra/issues/608)
- Host list missing patch is buggy [\#604](https://github.com/vatesfr/xen-orchestra/issues/604)
- Servers infos should not been refreshed while a field is being edited [\#595](https://github.com/vatesfr/xen-orchestra/issues/595)
- Servers list should not been re-order while a field is being edited [\#594](https://github.com/vatesfr/xen-orchestra/issues/594)
- Correctly display size in interface \(binary scale\) [\#592](https://github.com/vatesfr/xen-orchestra/issues/592)
- Display failures on VM boot order modification [\#560](https://github.com/vatesfr/xen-orchestra/issues/560)
- `vm.setBootOrder\(\)` should throw errors on failures \(non-HVM VMs\) [\#559](https://github.com/vatesfr/xen-orchestra/issues/559)
- Hide boot order form for non-HVM VMs [\#558](https://github.com/vatesfr/xen-orchestra/issues/558)
- Allow editing PV args even when empty \(but only for PV VMs\) [\#557](https://github.com/vatesfr/xen-orchestra/issues/557)
- Crashes when using legacy event system [\#556](https://github.com/vatesfr/xen-orchestra/issues/556)
- XenServer patches check error for 6.1 [\#555](https://github.com/vatesfr/xen-orchestra/issues/555)
- activation plugin xo-server-transport-email  [\#553](https://github.com/vatesfr/xen-orchestra/issues/553)
- Server error with JSON on 32 bits Dom0 [\#552](https://github.com/vatesfr/xen-orchestra/issues/552)
- Cloud Config drive shouldn't be created on default SR [\#548](https://github.com/vatesfr/xen-orchestra/issues/548)
- Deep properties cannot be edited in plugins configuration form [\#521](https://github.com/vatesfr/xen-orchestra/issues/521)
- Aborted VM export should cancel the operation [\#490](https://github.com/vatesfr/xen-orchestra/issues/490)
- VM missing with same UUID after an inter-pool migration [\#284](https://github.com/vatesfr/xen-orchestra/issues/284)

## **4.10.0** (2015-11-27)

Job management, email notifications, CoreOS/Docker, Quiesce snapshots...

### Enhancements

- Job management ([xo-web#487](https://github.com/vatesfr/xen-orchestra/issues/487))
- Patch upload on all connected servers ([xo-web#168](https://github.com/vatesfr/xen-orchestra/issues/168))
- Emergency shutdown ([xo-web#185](https://github.com/vatesfr/xen-orchestra/issues/185))
- CoreOS/docker template install ([xo-web#246](https://github.com/vatesfr/xen-orchestra/issues/246))
- Email for backups ([xo-web#308](https://github.com/vatesfr/xen-orchestra/issues/308))
- Console Clipboard ([xo-web#408](https://github.com/vatesfr/xen-orchestra/issues/408))
- Logs from CLI ([xo-web#486](https://github.com/vatesfr/xen-orchestra/issues/486))
- Save disconnected servers ([xo-web#489](https://github.com/vatesfr/xen-orchestra/issues/489))
- Snapshot with quiesce ([xo-web#491](https://github.com/vatesfr/xen-orchestra/issues/491))
- Start VM in reovery mode ([xo-web#495](https://github.com/vatesfr/xen-orchestra/issues/495))
- Username in logs ([xo-web#498](https://github.com/vatesfr/xen-orchestra/issues/498))
- Delete associated tokens with user ([xo-web#500](https://github.com/vatesfr/xen-orchestra/issues/500))
- Validate plugin configuration ([xo-web#503](https://github.com/vatesfr/xen-orchestra/issues/503))
- Avoid non configured plugins to be loaded ([xo-web#504](https://github.com/vatesfr/xen-orchestra/issues/504))
- Verbose API logs if configured ([xo-web#505](https://github.com/vatesfr/xen-orchestra/issues/505))
- Better backup overview ([xo-web#512](https://github.com/vatesfr/xen-orchestra/issues/512))
- VM auto power on ([xo-web#519](https://github.com/vatesfr/xen-orchestra/issues/519))
- Title property supported in config schema ([xo-web#522](https://github.com/vatesfr/xen-orchestra/issues/522))
- Start VM export only when necessary ([xo-web#534](https://github.com/vatesfr/xen-orchestra/issues/534))
- Input type should be number ([xo-web#538](https://github.com/vatesfr/xen-orchestra/issues/538))

### Bug fixes

- Numbers/int support in plugins config ([xo-web#531](https://github.com/vatesfr/xen-orchestra/issues/531))
- Boolean support in plugins config ([xo-web#528](https://github.com/vatesfr/xen-orchestra/issues/528))
- Keyboard unusable outside console ([xo-web#513](https://github.com/vatesfr/xen-orchestra/issues/513))
- UsernameField for SAML ([xo-web#513](https://github.com/vatesfr/xen-orchestra/issues/513))
- Wrong display of "no plugin found" ([xo-web#508](https://github.com/vatesfr/xen-orchestra/issues/508))
- Bower build error ([xo-web#488](https://github.com/vatesfr/xen-orchestra/issues/488))
- VM cloning should require SR permission ([xo-web#472](https://github.com/vatesfr/xen-orchestra/issues/472))
- Xen tools status ([xo-web#471](https://github.com/vatesfr/xen-orchestra/issues/471))
- Can't delete ghost user ([xo-web#464](https://github.com/vatesfr/xen-orchestra/issues/464))
- Stats with old versions of Node ([xo-web#463](https://github.com/vatesfr/xen-orchestra/issues/463))

## **4.9.0** (2015-11-13)

Automated DR, restore backup, VM copy

### Enhancements

- DR: schedule VM export on other host ([xo-web#447](https://github.com/vatesfr/xen-orchestra/issues/447))
- Scheduler logs ([xo-web#390](https://github.com/vatesfr/xen-orchestra/issues/390) and [xo-web#477](https://github.com/vatesfr/xen-orchestra/issues/477))
- Restore backups ([xo-web#450](https://github.com/vatesfr/xen-orchestra/issues/350))
- Disable backup compression ([xo-web#467](https://github.com/vatesfr/xen-orchestra/issues/467))
- Copy VM to another SR (even remote) ([xo-web#475](https://github.com/vatesfr/xen-orchestra/issues/475))
- VM stats without time sync ([xo-web#460](https://github.com/vatesfr/xen-orchestra/issues/460))
- Stats perfs for high CPU numbers ([xo-web#461](https://github.com/vatesfr/xen-orchestra/issues/461))

### Bug fixes

- Rolling backup bug ([xo-web#484](https://github.com/vatesfr/xen-orchestra/issues/484))
- vCPUs/CPUs inversion in dashboard ([xo-web#481](https://github.com/vatesfr/xen-orchestra/issues/481))
- Machine to template ([xo-web#459](https://github.com/vatesfr/xen-orchestra/issues/459))

### Misc

- Console fix in XenServer ([xo-web#406](https://github.com/vatesfr/xen-orchestra/issues/406))

## **4.8.0** (2015-10-29)

Fully automated patch system, ACLs inheritance, stats performance improved.

### Enhancements

- ACLs inheritance ([xo-web#279](https://github.com/vatesfr/xen-orchestra/issues/279))
- Patch automatically all missing updates ([xo-web#281](https://github.com/vatesfr/xen-orchestra/issues/281))
- Intelligent stats polling ([xo-web#432](https://github.com/vatesfr/xen-orchestra/issues/432))
- Cache latest result of stats request ([xo-web#431](https://github.com/vatesfr/xen-orchestra/issues/431))
- Improve stats polling on multiple objects ([xo-web#433](https://github.com/vatesfr/xen-orchestra/issues/433))
- Patch upload task should display the patch name ([xo-web#449](https://github.com/vatesfr/xen-orchestra/issues/449))
- Backup filename for Windows ([xo-web#448](https://github.com/vatesfr/xen-orchestra/issues/448))
- Specific distro icons ([xo-web#446](https://github.com/vatesfr/xen-orchestra/issues/446))
- PXE boot for HVM ([xo-web#436](https://github.com/vatesfr/xen-orchestra/issues/436))
- Favicon display before sign in ([xo-web#428](https://github.com/vatesfr/xen-orchestra/issues/428))
- Registration renewal ([xo-web#424](https://github.com/vatesfr/xen-orchestra/issues/424))
- Reconnect to the host if pool merge fails ([xo-web#403](https://github.com/vatesfr/xen-orchestra/issues/403))
- Avoid brute force login ([xo-web#339](https://github.com/vatesfr/xen-orchestra/issues/339))
- Missing FreeBSD icon ([xo-web#136](https://github.com/vatesfr/xen-orchestra/issues/136))
- Hide halted objects in the Health view ([xo-web#457](https://github.com/vatesfr/xen-orchestra/issues/457))
- Click on "Remember me" label ([xo-web#438](https://github.com/vatesfr/xen-orchestra/issues/438))

### Bug fixes

- Pool patches in multiple pools not displayed ([xo-web#442](https://github.com/vatesfr/xen-orchestra/issues/442))
- VM Import crashes with Chrome ([xo-web#427](https://github.com/vatesfr/xen-orchestra/issues/427))
- Cannot open a direct link ([xo-web#371](https://github.com/vatesfr/xen-orchestra/issues/371))
- Patch display edge case ([xo-web#309](https://github.com/vatesfr/xen-orchestra/issues/309))
- VM snapshot should require user permission on SR ([xo-web#429](https://github.com/vatesfr/xen-orchestra/issues/429))

## **4.7.0** (2015-10-12)

Plugin config management and browser notifications.

### Enhancements

- Plugin management in the web interface ([xo-web#352](https://github.com/vatesfr/xen-orchestra/issues/352))
- Browser notifications ([xo-web#402](https://github.com/vatesfr/xen-orchestra/issues/402))
- Graph selector ([xo-web#400](https://github.com/vatesfr/xen-orchestra/issues/400))
- Circle packing visualization ([xo-web#374](https://github.com/vatesfr/xen-orchestra/issues/374))
- Password generation ([xo-web#397](https://github.com/vatesfr/xen-orchestra/issues/397))
- Password reveal during user creation ([xo-web#396](https://github.com/vatesfr/xen-orchestra/issues/396))
- Add host to a pool ([xo-web#62](https://github.com/vatesfr/xen-orchestra/issues/62))
- Better modal when removing a host from a pool ([xo-web#405](https://github.com/vatesfr/xen-orchestra/issues/405))
- Drop focus on CD/ISO selector ([xo-web#290](https://github.com/vatesfr/xen-orchestra/issues/290))
- Allow non persistent session ([xo-web#243](https://github.com/vatesfr/xen-orchestra/issues/243))

### Bug fixes

- VM export permission corrected ([xo-web#410](https://github.com/vatesfr/xen-orchestra/issues/410))
- Proper host removal in a pool ([xo-web#402](https://github.com/vatesfr/xen-orchestra/issues/402))
- Sub-optimal tooltip placement ([xo-web#421](https://github.com/vatesfr/xen-orchestra/issues/421))
- VM migrate host incorrect target ([xo-web#419](https://github.com/vatesfr/xen-orchestra/issues/419))
- Alone host can't leave its pool ([xo-web#414](https://github.com/vatesfr/xen-orchestra/issues/414))

## **4.6.0** (2015-09-25)

Tags management and new visualization.

### Enhancements

- Multigraph for correlation ([xo-web#358](https://github.com/vatesfr/xen-orchestra/issues/358))
- Tags management ([xo-web#367](https://github.com/vatesfr/xen-orchestra/issues/367))
- Google Provider for authentication ([xo-web#363](https://github.com/vatesfr/xen-orchestra/issues/363))
- Password change for users ([xo-web#362](https://github.com/vatesfr/xen-orchestra/issues/362))
- Better live migration process ([xo-web#237](https://github.com/vatesfr/xen-orchestra/issues/237))
- VDI search filter in SR view ([xo-web#222](https://github.com/vatesfr/xen-orchestra/issues/222))
- PV args during VM creation ([xo-web#112](https://github.com/vatesfr/xen-orchestra/issues/330))
- PV args management ([xo-web#394](https://github.com/vatesfr/xen-orchestra/issues/394))
- Confirmation dialog on important actions ([xo-web#350](https://github.com/vatesfr/xen-orchestra/issues/350))
- New favicon ([xo-web#369](https://github.com/vatesfr/xen-orchestra/issues/369))
- Filename of VM for exports ([xo-web#370](https://github.com/vatesfr/xen-orchestra/issues/370))
- ACLs rights edited on the fly ([xo-web#323](https://github.com/vatesfr/xen-orchestra/issues/323))
- Heatmap values now human readable ([xo-web#342](https://github.com/vatesfr/xen-orchestra/issues/342))

### Bug fixes

- Export backup fails if no tags specified ([xo-web#383](https://github.com/vatesfr/xen-orchestra/issues/383))
- Wrong login give an obscure error message ([xo-web#373](https://github.com/vatesfr/xen-orchestra/issues/373))
- Update view is broken during updates ([xo-web#356](https://github.com/vatesfr/xen-orchestra/issues/356))
- Settings/dashboard menu incorrect display ([xo-web#357](https://github.com/vatesfr/xen-orchestra/issues/357))
- Console View Not refreshing if the VM restart ([xo-web#107](https://github.com/vatesfr/xen-orchestra/issues/107))

## **4.5.1** (2015-09-16)

An issue in `xo-web` with the VM view.

### Bug fix

- Attach disk/new disk/create interface is broken ([xo-web#378](https://github.com/vatesfr/xen-orchestra/issues/378))

## **4.5.0** (2015-09-11)

A new dataviz (parallel coord), a new provider (GitHub) and faster consoles.

### Enhancements

- Parallel coordinates view ([xo-web#333](https://github.com/vatesfr/xen-orchestra/issues/333))
- Faster consoles ([xo-web#337](https://github.com/vatesfr/xen-orchestra/issues/337))
- Disable/hide button ([xo-web#268](https://github.com/vatesfr/xen-orchestra/issues/268))
- More details on missing-guest-tools ([xo-web#304](https://github.com/vatesfr/xen-orchestra/issues/304))
- Scheduler meta data export ([xo-web#315](https://github.com/vatesfr/xen-orchestra/issues/315))
- Better heatmap ([xo-web#330](https://github.com/vatesfr/xen-orchestra/issues/330))
- Faster dashboard ([xo-web#331](https://github.com/vatesfr/xen-orchestra/issues/331))
- Faster sunburst ([xo-web#332](https://github.com/vatesfr/xen-orchestra/issues/332))
- GitHub provider for auth ([xo-web#334](https://github.com/vatesfr/xen-orchestra/issues/334))
- Filter networks for users ([xo-web#347](https://github.com/vatesfr/xen-orchestra/issues/347))
- Add networks in ACLs ([xo-web#348](https://github.com/vatesfr/xen-orchestra/issues/348))
- Better looking login page ([xo-web#341](https://github.com/vatesfr/xen-orchestra/issues/341))
- Real time dataviz (dashboard) ([xo-web#349](https://github.com/vatesfr/xen-orchestra/issues/349))

### Bug fixes

- Typo in dashboard ([xo-web#355](https://github.com/vatesfr/xen-orchestra/issues/355))
- Global RAM usage fix ([xo-web#356](https://github.com/vatesfr/xen-orchestra/issues/356))
- Re-allowing XO behind a reverse proxy ([xo-web#361](https://github.com/vatesfr/xen-orchestra/issues/361))

## **4.4.0** (2015-08-28)

SSO and Dataviz are the main features for this release.

### Enhancements

- Dataviz storage usage ([xo-web#311](https://github.com/vatesfr/xen-orchestra/issues/311))
- Heatmap in health view ([xo-web#329](https://github.com/vatesfr/xen-orchestra/issues/329))
- SSO for SAML and other providers ([xo-web#327](https://github.com/vatesfr/xen-orchestra/issues/327))
- Better UI for ACL objects attribution ([xo-web#320](https://github.com/vatesfr/xen-orchestra/issues/320))
- Refresh the browser after an update ([xo-web#318](https://github.com/vatesfr/xen-orchestra/issues/318))
- Clean CSS and Flexbox usage ([xo-web#239](https://github.com/vatesfr/xen-orchestra/issues/239))

### Bug fixes

- Admin only accessible views ([xo-web#328](https://github.com/vatesfr/xen-orchestra/issues/328))
- Hide "base copy" VDIs ([xo-web#324](https://github.com/vatesfr/xen-orchestra/issues/324))
- ACLs on VIFs for non-admins ([xo-web#322](https://github.com/vatesfr/xen-orchestra/issues/322))
- Updater display problems ([xo-web#313](https://github.com/vatesfr/xen-orchestra/issues/313))

## **4.3.0** (2015-07-22)

Scheduler for rolling backups

### Enhancements

- Rolling backup scheduler ([xo-web#278](https://github.com/vatesfr/xen-orchestra/issues/278))
- Clean snapshots of removed VMs ([xo-web#301](https://github.com/vatesfr/xen-orchestra/issues/301))

### Bug fixes

- VM export ([xo-web#307](https://github.com/vatesfr/xen-orchestra/issues/307))
- Remove VM VDIs ([xo-web#303](https://github.com/vatesfr/xen-orchestra/issues/303))
- Pagination fails ([xo-web#302](https://github.com/vatesfr/xen-orchestra/issues/302))

## **4.2.0** (2015-06-29)

Huge performance boost, scheduler for rolling snapshots and backward compatibility for XS 5.x series

### Enhancements

- Rolling snapshots scheduler ([xo-web#176](https://github.com/vatesfr/xen-orchestra/issues/176))
- Huge perf boost ([xen-api#1](https://github.com/julien-f/js-xen-api/issues/1))
- Backward compatibility ([xo-web#296](https://github.com/vatesfr/xen-orchestra/issues/296))

### Bug fixes

- VDI attached on a VM missing in SR view ([xo-web#294](https://github.com/vatesfr/xen-orchestra/issues/294))
- Better VM creation process ([xo-web#292](https://github.com/vatesfr/xen-orchestra/issues/292))

## **4.1.0** (2015-06-10)

Add the drag'n drop support from VM live migration, better ACLs groups UI.

### Enhancements

- Drag'n drop VM in tree view for live migration ([xo-web#277](https://github.com/vatesfr/xen-orchestra/issues/277))
- Better group view with objects ACLs ([xo-web#276](https://github.com/vatesfr/xen-orchestra/issues/276))
- Hide non-visible objects ([xo-web#272](https://github.com/vatesfr/xen-orchestra/issues/272))

### Bug fixes

- Convert to template displayed when the VM is not halted ([xo-web#286](https://github.com/vatesfr/xen-orchestra/issues/286))
- Lost some data when refresh some views ([xo-web#271](https://github.com/vatesfr/xen-orchestra/issues/271))
- Suspend button don't trigger any permission message ([xo-web#270](https://github.com/vatesfr/xen-orchestra/issues/270))
- Create network interfaces shouldn't call xoApi directly ([xo-web#269](https://github.com/vatesfr/xen-orchestra/issues/269))
- Don't plug automatically a disk or a VIF if the VM is not running ([xo-web#287](https://github.com/vatesfr/xen-orchestra/issues/287))

## **4.0.2** (2015-06-01)

An issue in `xo-server` with the password of default admin account and also a UI fix.

### Bug fixes

- Cannot modify admin account ([xo-web#265](https://github.com/vatesfr/xen-orchestra/issues/265))
- Password field seems to keep empty/reset itself after 1-2 seconds ([xo-web#264](https://github.com/vatesfr/xen-orchestra/issues/264))

## **4.0.1** (2015-05-30)

An issue with the updater in HTTPS was left in the *4.0.0*. This patch release fixed
it.

### Bug fixes

- allow updater to work in HTTPS ([xo-web#266](https://github.com/vatesfr/xen-orchestra/issues/266))

## **4.0.0** (2015-05-29)

[Blog post of this release](https://xen-orchestra.com/blog/xen-orchestra-4-0).

### Enhancements

- advanced ACLs ([xo-web#209](https://github.com/vatesfr/xen-orchestra/issues/209))
- xenserver update management ([xo-web#174](https://github.com/vatesfr/xen-orchestra/issues/174) & [xo-web#259](https://github.com/vatesfr/xen-orchestra/issues/259))
- docker control ([xo-web#211](https://github.com/vatesfr/xen-orchestra/issues/211))
- better responsive design ([xo-web#252](https://github.com/vatesfr/xen-orchestra/issues/252))
- host stats ([xo-web#255](https://github.com/vatesfr/xen-orchestra/issues/255))
- pagination ([xo-web#221](https://github.com/vatesfr/xen-orchestra/issues/221))
- web updater
- better VM creation process([xo-web#256](https://github.com/vatesfr/xen-orchestra/issues/256))
- VM boot order([xo-web#251](https://github.com/vatesfr/xen-orchestra/issues/251))
- new mapped collection([xo-server#47](https://github.com/vatesfr/xo-server/issues/47))
- resource location in ACL view ([xo-web#245](https://github.com/vatesfr/xen-orchestra/issues/245))

### Bug fixes

- wrong calulation of RAM amounts ([xo-web#51](https://github.com/vatesfr/xen-orchestra/issues/51))
- checkbox not aligned ([xo-web#253](https://github.com/vatesfr/xen-orchestra/issues/253))
- VM stats behavior more robust ([xo-web#250](https://github.com/vatesfr/xen-orchestra/issues/250))
- XO not on the root of domain ([xo-web#254](https://github.com/vatesfr/xen-orchestra/issues/254))


## **3.9.1** (2015-04-21)

A few bugs hve made their way into *3.9.0*, this minor release fixes
them.

### Bug fixes

- correctly keep the VM guest metrics up to date ([xo-web#172](https://github.com/vatesfr/xen-orchestra/issues/172))
- fix edition of a VM snapshot ([b04111c](https://github.com/vatesfr/xo-server/commit/b04111c79ba8937778b84cb861bb7c2431162c11))
- do not fetch stats if the VM state is transitioning ([a5c9880](https://github.com/vatesfr/xen-orchestra/commit/a5c98803182792d2fe5ceb840ae1e23a8b767923))
- fix broken Angular due to new version of Babel which breaks ngAnnotate ([0a9c868](https://github.com/vatesfr/xen-orchestra/commit/0a9c868678d239e5b3e54b4d2bc3bd14b5400120))
- feedback when connecting/disconnecting a server ([027d1e8](https://github.com/vatesfr/xen-orchestra/commit/027d1e8cb1f2431e67042e1eec51690b2bc54ad7))
- clearer error message if a server is unreachable ([06ca007](https://github.com/vatesfr/xo-server/commit/06ca0079b321e757aaa4112caa6f92a43193e35d))

## **3.9.0** (2015-04-20)

[Blog post of this release](https://xen-orchestra.com/blog/xen-orchestra-3-9).

### Enhancements

- ability to manually connect/disconnect a server ([xo-web#88](https://github.com/vatesfr/xen-orchestra/issues/88) & [xo-web#234](https://github.com/vatesfr/xen-orchestra/issues/234))
- display the connection status of a server ([xo-web#103](https://github.com/vatesfr/xen-orchestra/issues/103))
- better feedback when connecting to a server ([xo-web#210](https://github.com/vatesfr/xen-orchestra/issues/210))
- ability to add a local LVM SR ([xo-web#219](https://github.com/vatesfr/xen-orchestra/issues/219))
- display virtual GPUs in VM view ([xo-web#223](https://github.com/vatesfr/xen-orchestra/issues/223))
- ability to automatically start a VM with its host ([xo-web#224](https://github.com/vatesfr/xen-orchestra/issues/224))
- ability to create networks ([xo-web#225](https://github.com/vatesfr/xen-orchestra/issues/225))
- live charts for a VM CPU/disk/network & RAM ([xo-web#228](https://github.com/vatesfr/xen-orchestra/issues/228) & [xo-server#51](https://github.com/vatesfr/xo-server/issues/51))
- remove VM import progress notifications (redundant with the tasks list) ([xo-web#235](https://github.com/vatesfr/xen-orchestra/issues/235))
- XO-Server sources are compiled to JS prior distribution: less bugs & faster startups ([xo-server#50](https://github.com/vatesfr/xo-server/issues/50))
- use XAPI `event.from()` instead of `event.next()` which leads to faster connection ([xo-server#52](https://github.com/vatesfr/xo-server/issues/52))

### Bug fixes

- removed servers are properly disconnected ([xo-web#61](https://github.com/vatesfr/xen-orchestra/issues/61))
- fix VM creation with multiple interfaces ([xo-wb#229](https://github.com/vatesfr/xo-wb/issues/229))
- disconnected servers are properly removed from the interface ([xo-web#234](https://github.com/vatesfr/xen-orchestra/issues/234))

## **3.8.0** (2015-03-27)

[Blog post of this release](https://xen-orchestra.com/blog/xen-orchestra-3-8).

### Enhancements

- initial plugin system ([xo-server#37](https://github.com/vatesfr/xo-server/issues/37))
- new authentication system based on providers ([xo-server#39](https://github.com/vatesfr/xo-server/issues/39))
- LDAP authentication plugin for XO-Server ([xo-server#40](https://github.com/vatesfr/xo-server/issues/40))
- disk creation on the VM page ([xo-web#215](https://github.com/vatesfr/xen-orchestra/issues/215))
- network creation on the VM page ([xo-web#216](https://github.com/vatesfr/xen-orchestra/issues/216))
- charts on the host and SR pages ([xo-web#217](https://github.com/vatesfr/xen-orchestra/issues/217))

### Bug fixes

- fix *Invalid parameter(s)* message on the settings page ([xo-server#49](https://github.com/vatesfr/xo-server/issues/49))
- fix mouse clicks in console ([xo-web#205](https://github.com/vatesfr/xen-orchestra/issues/205))
- fix user editing on the settings page ([xo-web#206](https://github.com/vatesfr/xen-orchestra/issues/206))

## **3.7.0** (2015-03-06)

*Highlights in this release are the [initial ACLs implementation](https://xen-orchestra.com/blog/xen-orchestra-3-7-is-out-acls-in-early-access), [live migration for VDIs](https://xen-orchestra.com/blog/moving-vdi-in-live) and the ability to [create a new storage repository](https://xen-orchestra.com/blog/create-a-storage-repository-with-xen-orchestra/).*

### Enhancements

- ability to live migrate a VM between hosts with different CPUs ([xo-web#126](https://github.com/vatesfr/xen-orchestra/issues/126))
- ability to live migrate a VDI ([xo-web#177](https://github.com/vatesfr/xen-orchestra/issues/177))
- display a notification on VM creation ([xo-web#178](https://github.com/vatesfr/xen-orchestra/issues/178))
- ability to create/attach a iSCSI/NFS/ISO SR ([xo-web#179](https://github.com/vatesfr/xen-orchestra/issues/179))
- display SR available space on VM creation ([xo-web#180](https://github.com/vatesfr/xen-orchestra/issues/180))
- ability to enable and disable host on the tree view ([xo-web#181](https://github.com/vatesfr/xen-orchestra/issues/181) & [xo-web#182](https://github.com/vatesfr/xen-orchestra/issues/182))
- ability to suspend/resume a VM ([xo-web#186](https://github.com/vatesfr/xen-orchestra/issues/186))
- display Linux icon for SUSE Linux Enterprise Server distribution ([xo-web#187](https://github.com/vatesfr/xen-orchestra/issues/187))
- correctly handle incorrectly formated token in cookies ([xo-web#192](https://github.com/vatesfr/xen-orchestra/issues/192))
- display host manufacturer in host view ([xo-web#195](https://github.com/vatesfr/xen-orchestra/issues/195))
- only display task concerning authorized objects ([xo-web#197](https://github.com/vatesfr/xen-orchestra/issues/197))
- better welcome message ([xo-web#199](https://github.com/vatesfr/xen-orchestra/issues/199))
- initial ACLs ([xo-web#202](https://github.com/vatesfr/xen-orchestra/issues/202))
- display an action panel to rescan, remove, attach and forget a SR ([xo-web#203](https://github.com/vatesfr/xen-orchestra/issues/203))
- display current active tasks in navbar ([xo-web#204](https://github.com/vatesfr/xen-orchestra/issues/204))

### Bug fixes

- implements a proxy which fixes consoles over HTTPs ([xo#14](https://github.com/vatesfr/xo/issues/14))
- fix tasks listing in host view ([xo-server#43](https://github.com/vatesfr/xo-server/issues/43))
- fix console view on IE ([xo-web#184](https://github.com/vatesfr/xen-orchestra/issues/184))
- fix out of sync objects in XO-Web ([xo-web#142](https://github.com/vatesfr/xen-orchestra/issues/142))
- fix incorrect connection status displayed in login view ([xo-web#193](https://github.com/vatesfr/xen-orchestra/issues/193))
- fix *flickering* tree view ([xo-web#194](https://github.com/vatesfr/xen-orchestra/issues/194))
- single host pools should not have a dropdown menu in tree view ([xo-web#198](https://github.com/vatesfr/xen-orchestra/issues/198))

## **3.6.0** (2014-11-28)

### Enhancements

- upload and apply patches to hosts/pools ([xo-web#150](https://github.com/vatesfr/xen-orchestra/issues/150))
- import VMs ([xo-web#151](https://github.com/vatesfr/xen-orchestra/issues/151))
- export VMs ([xo-web#152](https://github.com/vatesfr/xen-orchestra/issues/152))
- migrate VMs to another pool ([xo-web#153](https://github.com/vatesfr/xen-orchestra/issues/153))
- display pool even for single host ([xo-web#155](https://github.com/vatesfr/xen-orchestra/issues/155))
- start halted hosts with wake-on-LAN ([xo-web#154](https://github.com/vatesfr/xen-orchestra/issues/154))
- list of uploaded/applied patches ([xo-web#156](https://github.com/vatesfr/xen-orchestra/issues/156))
- use Angular 1.3 from npm ([xo-web#157](https://github.com/vatesfr/xen-orchestra/issues/157) & [xo-web#160](https://github.com/vatesfr/xen-orchestra/issues/160))
- more feedbacks on actions ([xo-web#165](https://github.com/vatesfr/xen-orchestra/issues/165))
- only buttons compatible with VM states are displayed ([xo-web#166](https://github.com/vatesfr/xen-orchestra/issues/166))
- export VM snapshot ([xo-web#167](https://github.com/vatesfr/xen-orchestra/issues/167))
- plug/unplug a SR to a host ([xo-web#169](https://github.com/vatesfr/xen-orchestra/issues/169))
- plug a SR to all available hosts ([xo-web#170](https://github.com/vatesfr/xen-orchestra/issues/170))
- disks editing on SR page ([xo-web#171](https://github.com/vatesfr/xen-orchestra/issues/171))
- export of running VMs ([xo-server#36](https://github.com/vatesfr/xo-server/issues/36))

### Bug fixes

- disks editing on VM page should work ([xo-web#86](https://github.com/vatesfr/xen-orchestra/issues/86))
- dropdown menus should close after selecting an item ([xo-web#140](https://github.com/vatesfr/xen-orchestra/issues/140))
- user creation should require a password ([xo-web#143](https://github.com/vatesfr/xen-orchestra/issues/143))
- server connection should require a user and a password ([xo-web#144](https://github.com/vatesfr/xen-orchestra/issues/144))
- snapshot deletion should work ([xo-server#147](https://github.com/vatesfr/xo-server/issues/147))
- VM console should work in Chrome ([xo-web#149](https://github.com/vatesfr/xen-orchestra/issues/149))
- tooltips should work ([xo-web#163](https://github.com/vatesfr/xen-orchestra/issues/163))
- disk plugged status should be automatically refreshed ([xo-web#164](https://github.com/vatesfr/xen-orchestra/issues/164))
- deleting users without tokens should not trigger an error ([xo-server#34](https://github.com/vatesfr/xo-server/issues/34))
- live pool master change should work ([xo-server#20](https://github.com/vatesfr/xo-server/issues/20))

## **3.5.1** (2014-08-19)

### Bug fixes

- pool view works again ([#139](https://github.com/vatesfr/xen-orchestra/issues/139))

## **3.5.0** (2014-08-14)

*[XO-Web](https://www.npmjs.org/package/xo-web) and [XO-Server](https://www.npmjs.org/package/xo-server) are now available as npm packages!*

### Enhancements

- XO-Server published on npm ([#26](https://github.com/vatesfr/xo-server/issues/26))
- XO-Server config is now in `/etc/xo-server/config.yaml` ([#33](https://github.com/vatesfr/xo-server/issues/33))
- paths in XO-Server's config are now relative to the config file ([#19](https://github.com/vatesfr/xo-server/issues/19))
- use the Linux icon for Fedora ([#131](https://github.com/vatesfr/xen-orchestra/issues/131))
- start/stop/reboot buttons on console page ([#121](https://github.com/vatesfr/xen-orchestra/issues/121))
- settings page now only accessible to admin ([#77](https://github.com/vatesfr/xen-orchestra/issues/77))
- redirection to the home page when a VM is deleted from its own page ([#56](https://github.com/vatesfr/xen-orchestra/issues/56))
- XO-Web published on npm ([#123](https://github.com/vatesfr/xen-orchestra/issues/123))
- buid process now use Browserify (([#125](https://github.com/vatesfr/xen-orchestra/issues/125), [#135](https://github.com/vatesfr/xen-orchestra/issues/135)))
- view are now written in Jade instead of HTML ([#124](https://github.com/vatesfr/xen-orchestra/issues/124))
- CSS autoprefixer to improve compatibility ([#132](https://github.com/vatesfr/xen-orchestra/issues/132), [#137](https://github.com/vatesfr/xen-orchestra/issues/137))

### Bug fixes

- force shutdown does not attempt a clean shutdown first anymore ([#29](https://github.com/vatesfr/xo-server/issues/29))
- shutdown hosts are now correctly reported as such ([#31](https://github.com/vatesfr/xen-orchestra/issues/31))
- incorrect VM metrics ([#54](https://github.com/vatesfr/xen-orchestra/issues/54), [#68](https://github.com/vatesfr/xen-orchestra/issues/68), [#108](https://github.com/vatesfr/xen-orchestra/issues/108))
- an user cannot delete itself ([#104](https://github.com/vatesfr/xen-orchestra/issues/104))
- in VM creation, required fields are now marked as such ([#113](https://github.com/vatesfr/xen-orchestra/issues/113), [#114](https://github.com/vatesfr/xen-orchestra/issues/114))

## **3.4.0** (2014-05-22)

*Highlight in this release is the new events system between XO-Web
and XO-Server which results in less bandwidth consumption as well as
better performance and reactivity.*

### Enhancements

- events system between XO-Web and XO-Server ([#52](https://github.com/vatesfr/xen-orchestra/issues/52))
- ability to clone/copy a VM ([#116](https://github.com/vatesfr/xen-orchestra/issues/116))
- mandatory log in page ([#120](https://github.com/vatesfr/xen-orchestra/issues/120))

### Bug fixes

- failure in VM creation ([#111](https://github.com/vatesfr/xen-orchestra/issues/111))

## **3.3.1** (2014-03-28)

### Enhancements

- console view is now prettier ([#92](https://github.com/vatesfr/xen-orchestra/issues/92))

### Bug fixes

- VM creation fails to incorrect dependencies ([xo-server/#24](https://github.com/vatesfr/xo-server/issues/24))
- VDIs list in SR view is blinking ([#109](https://github.com/vatesfr/xen-orchestra/issues/109))

## **3.3.0** (2014-03-07)

### Enhancements

- [Grunt](http://gruntjs.com/) has been replaced by [gulp.js](http://gulpjs.com/) ([#91](https://github.com/vatesfr/xen-orchestra/issues/91))
- a host can be detached from a pool ([#98](https://github.com/vatesfr/xen-orchestra/issues/98))
- snapshots management in VM view ([#99](https://github.com/vatesfr/xen-orchestra/issues/99))
- log deletion in VM view ([#100](https://github.com/vatesfr/xen-orchestra/issues/100))

### Bug fixes

- *Snapshot* not working in VM view ([#95](https://github.com/vatesfr/xen-orchestra/issues/95))
- Host *Reboot*/*Restart toolstack*/*Shutdown* not working in main view ([#97](https://github.com/vatesfr/xen-orchestra/issues/97))
- Bower cannot install `angular` automatically due to a version conflict ([#101](https://github.com/vatesfr/xen-orchestra/issues/101))
- Bower installs an incorrect version of `angular-animate` ([#102](https://github.com/vatesfr/xen-orchestra/issues/102))

## **3.2.0** (2014-02-21)

### Enhancements

- dependencies' versions should be fixed to ease deployment ([#93](https://github.com/vatesfr/xen-orchestra/issues/93))
- badges added to the README to see whether dependencies are up to date ([#90](https://github.com/vatesfr/xen-orchestra/issues/90))
- an error notification has been added when the connection to XO-Server failed ([#89](https://github.com/vatesfr/xen-orchestra/issues/89))
- in host view, there is now a link to the host console ([#87](https://github.com/vatesfr/xen-orchestra/issues/87))
- in VM view, deleting a disk requires a confirmation ([#85](https://github.com/vatesfr/xen-orchestra/issues/85))
- the VM and console icons are now different ([#80](https://github.com/vatesfr/xen-orchestra/issues/80))

### Bug fixes

- consoles now work in Google Chrome \o/ ([#46](https://github.com/vatesfr/xen-orchestra/issues/46))
- in host view, many buttons were not working ([#79](https://github.com/vatesfr/xen-orchestra/issues/79))
- in main view, incorrect icons were fixes ([#81](https://github.com/vatesfr/xen-orchestra/issues/81))
- MAC addresses should not be ignored during VM creation ([#94](https://github.com/vatesfr/xen-orchestra/issues/94))

## **3.1.0** (2014-02-14)

### Enhancements

- in VM view, interfaces' network should be displayed ([#64](https://github.com/vatesfr/xen-orchestra/issues/64))
- middle-click or `Ctrl`+click should open new windows (even on pseudo-links) ([#66](https://github.com/vatesfr/xen-orchestra/issues/66))
- lists should use natural sorting (e.g. *VM 2* before *VM 10*) ([#69](https://github.com/vatesfr/xen-orchestra/issues/69))

### Bug fixes

- consoles are not implemented for hosts ([#57](https://github.com/vatesfr/xen-orchestra/issues/57))
- it makes no sense to remove a stand-alone host from a pool (58)
- in VM view, the migrate button is not working ([#59](https://github.com/vatesfr/xen-orchestra/issues/59))
- pool and host names overflow their box in the main view ([#63](https://github.com/vatesfr/xen-orchestra/issues/63))
- in host view, interfaces incorrectly named *networks* and VLAN not shown ([#70](https://github.com/vatesfr/xen-orchestra/issues/70))
- VM suspended state is not properly handled ([#71](https://github.com/vatesfr/xen-orchestra/issues/71))
- unauthenticated users should not be able to access to consoles ([#73](https://github.com/vatesfr/xen-orchestra/issues/73))
- incorrect scroll (under the navbar) when the view changes ([#74](https://github.com/vatesfr/xen-orchestra/issues/74))
