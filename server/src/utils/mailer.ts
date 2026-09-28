import nodemailer from 'nodemailer';

// Gmail SMTP. GMAIL_USER + GMAIL_APP_PASSWORD env байвал жинхэнэ имэйл явна.
// Байхгүй бол dev горим — код server log дээр хэвлэгдэнэ (жинхэнэ имэйл явахгүй).
const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;

const transporter =
  user && pass ? nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }) : null;

export const emailConfigured = transporter !== null;

const PURPOSE_TEXT: Record<string, string> = {
  register: 'Бүртгэлээ баталгаажуулах',
  reset: 'Нууц үг сэргээх',
  'change-email': 'Сэргээх Gmail солих',
};

// Кодыг имэйлээр илгээнэ. Жинхэнэ имэйл явсан бол true, эс бөгөөс false
// (dev горим эсвэл илгээлт амжилтгүй) буцаана — энэ үед код хариунд буцаж дэлгэцэнд гарна.
export async function sendOtpEmail(to: string, code: string, purpose: string): Promise<boolean> {
  const title = PURPOSE_TEXT[purpose] ?? 'Баталгаажуулах код';

  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      // eslint-disable-next-line no-console
      console.error('[MAIL] GMAIL_USER/GMAIL_APP_PASSWORD тохируулаагүй — OTP илгээгдсэнгүй');
      return false;
    }
    // eslint-disable-next-line no-console
    console.log(`\n[DEV OTP] → ${to} | ${purpose} | код: ${code}\n`);
    return false;
  }

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:440px;margin:0 auto;padding:28px;background:#fdf6f0;border-radius:20px">
      <h1 style="color:#e8607a;font-style:italic;text-align:center;margin:0 0 4px">nous</h1>
      <p style="text-align:center;color:#9b8a93;margin:0 0 22px">хосуудын ертөнц</p>
      <p style="color:#2d1f2e;font-size:15px">${title}-ын код:</p>
      <div style="font-size:34px;font-weight:700;letter-spacing:8px;text-align:center;color:#2d1f2e;background:#fff8f5;border-radius:16px;padding:18px;margin:12px 0">${code}</div>
      <p style="color:#9b8a93;font-size:13px;text-align:center;margin-top:18px">Код 10 минутын дотор хүчинтэй. Хэрэв та хүсээгүй бол үл хайхрана уу.</p>
    </div>`;

  try {
    await transporter.sendMail({
      from: `nous <${user}>`,
      to,
      subject: `nous — ${title} (код: ${code})`,
      html,
    });
    return true;
  } catch (err) {
    // Имэйл илгээж чадсангүй (ж: буруу App Password) — кодыг log-д үлдээж,
    // бүртгэл эвдрэхээс сэргийлж false буцаана (код дэлгэцэнд гарна).
    // eslint-disable-next-line no-console
    console.error(
      `[MAIL ERROR] → ${to}: ${(err as Error).message}` +
        (process.env.NODE_ENV === 'production' ? '' : `\n[FALLBACK OTP] код: ${code}`),
    );
    return false;
  }
}
