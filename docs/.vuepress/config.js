module.exports = {
  head: [
    [
      'link',
      {
        rel: 'shortcut icon',
        href: 'https://xen-orchestra.com/assets/favicon.ico',
      },
    ],
  ],
  base: '/docs/',
  themeConfig: {
    smoothScroll: true,
    logo: 'https://xen-orchestra.com/blog/content/images/2017/05/xo-logo.png',
    lastUpdated: 'Last Updated', // add latest Git commit modification for each file
    repo: 'vatesfr/xen-orchestra', // point to the GH repo
    editLinks: true, // display link for people to edit a page
    editLinkText: 'Help us to improve this page!', // link text
    docsDir: 'docs',
    nav: [
      { text: 'Home', link: 'https://xen-orchestra.com' },
      { text: 'News', link: 'https://xen-orchestra.com/blog' },
      { text: 'Documentation', link: '/' },
    ],
    sidebar: [
      {
        title: 'Xen Orchestra Documentation', // required
        path: '/', // optional, link of the title, which should be an absolute path and must exist
        collapsable: false, // optional, defaults to true
        sidebarDepth: 1, // optional, defaults to 1
        children: [
          ['/installation', 'Installation'],
          ['/configuration', 'Configuration'],
          ['/updates', 'Updates'],
          ['/architecture', 'Architecture'],
          ['/troubleshooting', 'Troubleshooting'],
        ],
      },
      {
        title: 'Management', // required
        path: '/manage', // optional, link of the title, which should be an absolute path and must exist
        collapsable: false, // optional, defaults to true
        sidebarDepth: 1, // optional, defaults to 1
        children: [
          ['/management', 'Infrastructure'],
          ['/users', 'Users'],
          ['/advanced', 'Advanced features'],
          ['/load_balancing', 'VM Load Balancing'],
          ['/sdn_controller', 'SDN Controller'],
          ['/xosan', 'XOSAN'],
        ],
      },
      {
        title: 'Backup', // required
        path: '/backup', // optional, link of the title, which should be an absolute path and must exist
        collapsable: false, // optional, defaults to true
        sidebarDepth: 1, // optional, defaults to 1
        children: [
          ['/rolling_snapshots', 'Snapshots'],
          ['/full_backups', 'Full backup'],
          ['/delta_backups', 'Delta Backup'],
          ['/disaster_recovery.md', 'Disaster Recovery'],
          ['/continuous_replication', 'Continuous Replication'],
          ['/metadata_backup', 'Metadata Backup'],
          ['/backup_reports', 'Backup Reports'],
          ['/backup_troubleshooting', 'Backup Troubleshooting'],
        ],
      },
      {
        title: 'Support', // required
        path: '/support', // optional, link of the title, which should be an absolute path and must exist
        collapsable: false, // optional, defaults to true
        sidebarDepth: 1, // optional, defaults to 1
        children: [
          ['/xoa', 'XOA'],
          ['/community', 'Community'],
        ],
      },
      {
        title: 'Project', // required
        path: '/project', // optional, link of the title, which should be an absolute path and must exist
        collapsable: false, // optional, defaults to true
        sidebarDepth: 1, // optional, defaults to 1
        children: [
          ['/changelog', 'Changelog'],
          ['/code_of_conduct', 'Code of Conduct'],
          ['/contributing', 'Contributing'],
          ['/licenses', 'Licenses'],
          ['/roadmap', 'Roadmap'],
          ['/glossary', 'Glossary'],
        ],
      },
    ],
  },
}
