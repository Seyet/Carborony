import "server-only"

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

import { getInstagramEncryptionKey } from "./config"

const algorithm = "aes-256-gcm"
const encryptionVersion = 1

export type EncryptedInstagramToken = {
  ciphertext: string
  version: number
}

/** Encrypts a Meta access token before it crosses the database boundary. */
export function encryptInstagramToken(token: string): EncryptedInstagramToken {
  if (!token || token.length > 4_096) {
    throw new Error("The Instagram access token is invalid.")
  }

  const nonce = randomBytes(12)
  const cipher = createCipheriv(algorithm, getInstagramEncryptionKey(), nonce)
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ])
  const authenticationTag = cipher.getAuthTag()

  return {
    ciphertext: [
      `v${encryptionVersion}`,
      nonce.toString("base64url"),
      authenticationTag.toString("base64url"),
      encrypted.toString("base64url"),
    ].join("."),
    version: encryptionVersion,
  }
}

export function decryptInstagramToken(ciphertext: string, version: number) {
  if (version !== encryptionVersion) {
    throw new Error("This Instagram credential uses an unsupported encryption version.")
  }

  const [versionLabel, nonceValue, tagValue, encryptedValue, extra] = ciphertext.split(".")
  if (
    versionLabel !== `v${encryptionVersion}`
    || !nonceValue
    || !tagValue
    || !encryptedValue
    || extra !== undefined
  ) {
    throw new Error("The stored Instagram credential is invalid.")
  }

  try {
    const decipher = createDecipheriv(
      algorithm,
      getInstagramEncryptionKey(),
      Buffer.from(nonceValue, "base64url"),
    )
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"))
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    throw new Error("The stored Instagram credential could not be decrypted.")
  }
}
