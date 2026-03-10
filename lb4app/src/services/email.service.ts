import nodemailer, {Transporter} from 'nodemailer';

export type EmailSendOptions = {
  to: string;
  from: string;
  subject: string;
  html?: string;
  text?: string;
};

export class EmailService {
  private transporter?: Transporter;

  private getTransporter(): Transporter | undefined {
    if (process.env.EMAIL_ACTIVE !== 'true') {
      return undefined;
    }
    if (this.transporter) return this.transporter;

    const host = process.env.EMAIL_HOST;
    const portRaw = process.env.EMAIL_PORT;
    if (!host || !portRaw) {
      throw new Error('EmailService requires EMAIL_HOST and EMAIL_PORT');
    }

    const port = Number(portRaw);
    const secure = port !== 25;
    const auth =
      process.env.EMAIL_USER && process.env.EMAIL_PASS
        ? {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          }
        : undefined;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth,
      tls: {rejectUnauthorized: false},
    });
    return this.transporter;
  }

  send(options: EmailSendOptions, cb?: (err?: unknown, info?: unknown) => void) {
    let transporter: Transporter | undefined;
    try {
      transporter = this.getTransporter();
    } catch (err) {
      if (cb) {
        cb(err);
        return;
      }
      return Promise.reject(err);
    }

    if (!transporter) {
      const info = {accepted: [], rejected: [], response: 'Email disabled'};
      if (cb) {
        cb(undefined, info);
        return;
      }
      return Promise.resolve(info);
    }

    if (cb) {
      transporter.sendMail(options, cb);
      return;
    }
    return transporter.sendMail(options);
  }
}
