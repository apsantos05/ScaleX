# E-mail transacional (Resend + Supabase Auth) — passo a passo

Objetivo: e-mails de **confirmação de cadastro** e **recuperação de senha** chegando para qualquer cliente, e a
**confirmação de e-mail religada** (hoje está desligada para testes).

> Por que é obrigatório antes do lançamento: sem confirmação, qualquer pessoa cria conta com o e-mail de outra.
> O SMTP padrão do Supabase só entrega para membros da organização e tem limite de poucos e-mails por hora.

## 1. Domínio
Você precisa de um domínio próprio (ex.: `scalex.com.br`). O Resend só envia para qualquer destinatário a partir de um
domínio verificado. Registre em registro.br ou no provedor de sua preferência.

## 2. Resend (plano gratuito: 3.000 e-mails/mês, 100/dia)
1. Crie a conta em resend.com (de preferência com um e-mail da empresa).
2. **Domains › Add domain** → `scalex.com.br` (ou um subdomínio como `mail.scalex.com.br`).
3. Copie os registros DNS que o Resend mostrar (SPF/MX e DKIM) para o painel do seu domínio e clique em **Verify**.
4. **API Keys › Create API key** com permissão **Sending access**. Guarde a chave (começa com `re_`). Não cole no chat.

## 3. Supabase › Authentication
**Emails › SMTP Settings** → ative **Enable custom SMTP**:

| Campo | Valor |
|---|---|
| Sender email | `nao-responda@scalex.com.br` |
| Sender name | `ScaleX` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a chave `re_...` do Resend |

**Rate limits**: depois do SMTP próprio, ajuste "Rate limit for sending emails" para algo como 30/hora.

**URL Configuration**:
- Site URL: `https://scale-x-kkn5.vercel.app` (ou o domínio definitivo)
- Redirect URLs: `https://scale-x-kkn5.vercel.app/**` e `http://localhost:3000/**`
  (mantenha a lista restrita: o Supabase só aceita links para estes endereços)

**Sign In / Providers › User Signups**: **ligue de novo "Confirm email"**.

## 4. Modelos de e-mail em português (Authentication › Emails › Templates)

### Confirm signup
Assunto: `Confirme seu e-mail na ScaleX`
```html
<div style="background:#09090B;padding:32px;font-family:Arial,sans-serif;color:#F5F5F7">
  <p style="font-size:20px;font-weight:bold;letter-spacing:2px;margin:0 0 24px">SCALE<span style="color:#FF3045">X</span></p>
  <p style="font-size:16px;margin:0 0 16px">Falta só confirmar seu e-mail para ativar sua conta.</p>
  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#E0142C;color:#FFFFFF;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Confirmar e-mail</a>
  </p>
  <p style="font-size:13px;color:#9898A3">Se você não criou uma conta na ScaleX, ignore este e-mail.</p>
</div>
```

### Reset password
Assunto: `Redefina sua senha da ScaleX`
```html
<div style="background:#09090B;padding:32px;font-family:Arial,sans-serif;color:#F5F5F7">
  <p style="font-size:20px;font-weight:bold;letter-spacing:2px;margin:0 0 24px">SCALE<span style="color:#FF3045">X</span></p>
  <p style="font-size:16px;margin:0 0 16px">Recebemos um pedido para redefinir sua senha.</p>
  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#E0142C;color:#FFFFFF;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Criar nova senha</a>
  </p>
  <p style="font-size:13px;color:#9898A3">O link expira em 1 hora. Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>
</div>
```

## 5. Teste de ponta a ponta
1. Abra `/signup` em janela anônima e crie uma conta com um e-mail que **não** é da organização Supabase.
2. O e-mail deve chegar em segundos com o visual acima; o botão leva ao `/onboarding` já logado.
3. Em `/forgot-password`, peça a redefinição e conclua em `/reset-password`.
4. Convites de membros: o link é gerado em **Configurações › Membros** e pode ser copiado/compartilhado. Envio automático
   do convite por e-mail pode ser ligado depois usando a mesma conta do Resend.
