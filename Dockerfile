FROM centos:7 as base

RUN curl -sL https://rpm.nodesource.com/setup_12.x | bash - && \
    curl -sL https://dl.yarnpkg.com/rpm/yarn.repo | tee /etc/yum.repos.d/yarn.repo && \
    yum -y install libpng-devel git libvhdi-utils lvm2 cifs-utils \
      make automake gcc gcc-c++ nodejs yarn

WORKDIR /xen-orchestra

EXPOSE 80 443

FROM base as runtime

ADD . /xen-orchestra

RUN yarn && yarn build && yarn --production
