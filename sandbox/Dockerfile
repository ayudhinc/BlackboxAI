# BlackboxAI sandbox: Chromium in Xvfb, driven by xdotool, recorded by ffmpeg,
# with the AT-SPI bus up for native mode. Ubuntu 24.04 (Playwright's noble
# image ships an arm64 Chromium; Ubuntu's own chromium is snap-only). See the
# sandbox base decision in docs/decisions.md.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      xvfb openbox xdotool x11-utils ffmpeg x11vnc novnc websockify \
      at-spi2-core python3-pyatspi gir1.2-atspi-2.0 dbus-x11 fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/* \
 && ln -s "$(ls -d /ms-playwright/chromium-*/chrome-linux*/chrome | head -1)" /usr/local/bin/chromium \
 && mkdir -p /recordings && chown pwuser:pwuser /recordings

COPY bin/ /opt/blackbox/bin/
COPY fixtures/ /opt/blackbox/fixtures/

ENV DISPLAY=:99 \
    SCREEN_W=1280 \
    SCREEN_H=800 \
    PATH=/opt/blackbox/bin:$PATH

USER pwuser
WORKDIR /home/pwuser
ENTRYPOINT ["/opt/blackbox/bin/entrypoint"]
CMD ["sleep", "infinity"]
