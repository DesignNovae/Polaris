// Content adapter for the authored Site of the Year material and geometry.
let polarisNotice = {
  title: "POLARIS NOTICES",
  summary: "Updates for your academic journey.",
  body: "",
  category: "Announcement",
  date: "",
  priority: "normal",
};
let polarisCover = null,
  polarisLogo = null,
  polarisPage = 0,
  polarisPages = 1;
function noticeLines(ctx, text, width) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? line + " " + word : word;
      if (ctx.measureText(next).width <= width) {
        line = next;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      for (const character of word) {
        if (ctx.measureText(line + character).width > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}
function drawGame(ctx) {
  const COPPER = "#D99A63",
    SAND = "#F1C899",
    WHITE = "#F6F1E8";
  function drawStock() {
    const gradient = ctx.createLinearGradient(0, 0, TW, TH);
    gradient.addColorStop(0, "#171511");
    gradient.addColorStop(0.5, "#100E0C");
    gradient.addColorStop(1, "#241A13");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, TW, TH);
    const glow = ctx.createRadialGradient(940, 340, 0, 940, 340, 620);
    glow.addColorStop(0, "rgba(217,154,99,.18)");
    glow.addColorStop(1, "rgba(217,154,99,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, TW, TH);
    ctx.strokeStyle = "rgba(207,183,147,.055)";
    ctx.lineWidth = 1;
    for (let x = 80; x < TW; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x, TH - 80);
      ctx.stroke();
    }
    for (let y = 80; y < TH; y += 40) {
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.lineTo(TW - 80, y);
      ctx.stroke();
    }
    ctx.strokeStyle = COPPER;
    ctx.lineWidth = 4;
    [
      [70, 70, 1, 1],
      [TW - 70, 70, -1, 1],
      [TW - 70, TH - 70, -1, -1],
      [70, TH - 70, 1, -1],
    ].forEach(([x, y, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(x + 52 * sx, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + 52 * sy);
      ctx.stroke();
    });
    ctx.fillStyle = COPPER;
    ctx.font = "700 26px " + MONO;
    ctx.beginPath();
    ctx.moveTo(120, 166);
    ctx.lineTo(140, 178);
    ctx.lineTo(120, 190);
    ctx.closePath();
    ctx.fill();
    track(
      ctx,
      polarisNotice.category.toUpperCase() +
        (polarisNotice.priority === "important" ? " / IMPORTANT" : ""),
      156,
      188,
      4,
      false,
    );
    ctx.strokeStyle = "rgba(217,154,99,.34)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(120, 222);
    ctx.lineTo(TW - 120, 222);
    ctx.stroke();
  }
  drawStock();
  ctx.save();
  ctx.translate(986, 382);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * 100, Math.sin(a) * 100);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(217,154,99,.10)";
  ctx.fill();
  ctx.strokeStyle = COPPER;
  ctx.lineWidth = 3;
  ctx.stroke();
  if (polarisLogo) ctx.drawImage(polarisLogo, -60, -60, 120, 120);
  else {
    ctx.fillStyle = COPPER;
    ctx.beginPath();
    ctx.moveTo(0, -66);
    ctx.lineTo(15, -12);
    ctx.lineTo(60, 0);
    ctx.lineTo(15, 12);
    ctx.lineTo(0, 66);
    ctx.lineTo(-15, 12);
    ctx.lineTo(-60, 0);
    ctx.lineTo(-15, -12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  let titleSize = 92,
    titleLines;
  do {
    ctx.font = "600 " + titleSize + 'px "Inter Tight", Inter, sans-serif';
    titleLines = noticeLines(ctx, polarisNotice.title, 710);
    if (titleLines.length * titleSize * 1.08 <= 450) break;
    titleSize -= 4;
  } while (titleSize >= 28);
  let y = 380;
  titleLines.forEach((line, i) => {
    ctx.fillStyle = i === titleLines.length - 1 ? COPPER : WHITE;
    ctx.fillText(line, 120, y);
    y += titleSize * 1.08;
  });
  ctx.fillStyle = SAND;
  ctx.font = "700 25px " + MONO;
  track(ctx, "POLARIS / ACADEMIC NOTICES", 120, y + 4, 2, false);
  y += 72;
  const bodySize = window.innerWidth < 600 ? 52 : 35;
  ctx.font = "400 " + bodySize + "px Inter, sans-serif";
  const summary = noticeLines(ctx, polarisNotice.summary, 960);
  const body = noticeLines(ctx, polarisNotice.body, 960);
  const first = [];
  summary.forEach((line) => first.push({ line, color: SAND }));
  first.push({ line: "", color: WHITE });
  const content = body.map((line) => ({ line, color: WHITE }));
  const lineHeight = bodySize * 1.4;
  const coverHeight = polarisCover ? 300 : 0;
  const capacity = Math.max(
    1,
    Math.floor((1320 - y - coverHeight) / lineHeight),
  );
  const firstPage = first.concat(content).slice(0, capacity);
  const rest = first.concat(content).slice(capacity);
  const extraCapacity = Math.floor((1320 - 432) / lineHeight);
  const pages = [firstPage];
  for (let i = 0; i < rest.length; i += extraCapacity)
    pages.push(rest.slice(i, i + extraCapacity));
  polarisPages = pages.length;
  polarisPage = Math.max(0, Math.min(polarisPage, polarisPages - 1));
  if (polarisPage > 0) {
    drawStock();
    ctx.fillStyle = COPPER;
    ctx.font = '600 46px "Inter Tight", Inter, sans-serif';
    ctx.fillText(
      "CONTINUED / " + String(polarisPage + 1).padStart(2, "0"),
      120,
      344,
    );
    y = 432;
  }
  ctx.font = "400 " + bodySize + "px Inter, sans-serif";
  pages[polarisPage].forEach(({ line, color }) => {
    ctx.fillStyle = color;
    ctx.fillText(line, 120, y);
    y += lineHeight;
  });
  if (polarisCover && polarisPage === 0) {
    const top = Math.min(1320 - coverHeight, y + 10),
      w = 960,
      h = coverHeight - 25;
    const scale = Math.min(w / polarisCover.width, h / polarisCover.height);
    ctx.drawImage(
      polarisCover,
      120 + (w - polarisCover.width * scale) / 2,
      top,
      polarisCover.width * scale,
      polarisCover.height * scale,
    );
  }
  ctx.strokeStyle = "rgba(243,229,211,.18)";
  ctx.beginPath();
  ctx.moveTo(120, 1360);
  ctx.lineTo(TW - 120, 1360);
  ctx.stroke();
  ctx.fillStyle = COPPER;
  ctx.font = "700 26px " + MONO;
  track(ctx, "POLARIS", 120, 1424, 4, false);
  ctx.font = "400 20px " + MONO;
  ctx.fillStyle = "rgba(243,229,211,.65)";
  ctx.fillText(polarisNotice.date, 120, 1470);
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle =
      i < Math.ceil((16 * (polarisPage + 1)) / polarisPages)
        ? COPPER
        : "rgba(243,229,211,.14)";
    ctx.fillRect(120 + i * 30, 1532, 18, 18);
  }
  ctx.fillStyle = SAND;
  ctx.font = "400 22px " + MONO;
  ctx.textAlign = "right";
  ctx.fillText(
    String(polarisPage + 1).padStart(2, "0") +
      " / " +
      String(polarisPages).padStart(2, "0"),
    TW - 120,
    1550,
  );
  ctx.textAlign = "left";
}
