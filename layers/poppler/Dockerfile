FROM amazonlinux:2

ARG TARGET_PLATFORM
ENV PACKAGE_DIR=/package

RUN yum -y update && yum -y install \
    poppler-utils \
    poppler-data \
    fontconfig \
    freetype \
    dejavu-sans-fonts \
    liberation-fonts \
    libjpeg \
    libpng \
    libtiff \
    openjpeg \
    zip \
    && yum clean all

RUN mkdir -p \
    ${PACKAGE_DIR}/bin \
    ${PACKAGE_DIR}/lib \
    ${PACKAGE_DIR}/share/poppler \
    ${PACKAGE_DIR}/fonts

RUN cp /usr/bin/pdftocairo ${PACKAGE_DIR}/bin

RUN ldd /usr/bin/pdftocairo \
 | awk '{print $3}' \
 | grep '^/' \
 | xargs -I '{}' cp '{}' ${PACKAGE_DIR}/lib/

RUN cp -r /usr/share/poppler/* ${PACKAGE_DIR}/share/poppler/
RUN cp -r /usr/share/fonts/* ${PACKAGE_DIR}/fonts/

RUN chmod 755 ${PACKAGE_DIR}/bin/*

RUN cd ${PACKAGE_DIR} && zip -r9 /package.zip .

CMD cp /package.zip /workspace/poppler/release-${TARGET_PLATFORM}.zip
