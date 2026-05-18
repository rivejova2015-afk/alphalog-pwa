import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock openpgp entirely. The real lib generates RSA-4096 keys which takes
// 5-30 seconds per call — unacceptable in a unit test suite. We assert that
// our wrappers call into openpgp correctly and surface errors as expected.
const mockGenerateKey = vi.fn();
const mockReadKey = vi.fn();
const mockReadPrivateKey = vi.fn();
const mockReadMessage = vi.fn();
const mockCreateMessage = vi.fn();
const mockEncrypt = vi.fn();
const mockDecrypt = vi.fn();
const mockDecryptKey = vi.fn();

vi.mock("openpgp", () => ({
  generateKey: (...args: unknown[]) => mockGenerateKey(...args),
  readKey: (...args: unknown[]) => mockReadKey(...args),
  readPrivateKey: (...args: unknown[]) => mockReadPrivateKey(...args),
  readMessage: (...args: unknown[]) => mockReadMessage(...args),
  createMessage: (...args: unknown[]) => mockCreateMessage(...args),
  encrypt: (...args: unknown[]) => mockEncrypt(...args),
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
  decryptKey: (...args: unknown[]) => mockDecryptKey(...args),
}));

import {
  generateKeypair,
  encryptText,
  decryptText,
  encryptBytes,
  decryptBytes,
  verifyPublicKey,
  extractEmailFromKey,
} from "../openpgp";

describe("openpgp wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateKeypair", () => {
    it("retorna publicKey + privateKey + kdf con parámetros documentados", async () => {
      mockGenerateKey.mockResolvedValue({
        publicKey: "-----BEGIN PGP PUBLIC KEY BLOCK-----\n...",
        privateKey: "-----BEGIN PGP PRIVATE KEY BLOCK-----\n...",
      });
      const r = await generateKeypair("Alice", "alice@test.com", "strong-pass");
      expect(r.publicKey).toContain("PGP PUBLIC KEY");
      expect(r.privateKey).toContain("PGP PRIVATE KEY");
      expect(r.kdf.algorithm).toBe("Iterated and Salted S2K");
      expect(r.kdf.iterations).toBe(65536);
      expect(r.kdf.hashAlgorithm).toBe("SHA256");
    });

    it("usa RSA 4096 + identidad correcta + passphrase encriptando key", async () => {
      mockGenerateKey.mockResolvedValue({ publicKey: "pub", privateKey: "priv" });
      await generateKeypair("Bob", "bob@test.com", "secret");
      expect(mockGenerateKey).toHaveBeenCalledWith(expect.objectContaining({
        type: "rsa",
        rsaBits: 4096,
        userIDs: [{ name: "Bob", email: "bob@test.com" }],
        passphrase: "secret",
        format: "armored",
      }));
    });

    it("throw 'Key generation failed' cuando openpgp falla", async () => {
      mockGenerateKey.mockRejectedValue(new Error("entropy not available"));
      await expect(generateKeypair("X", "x@x.com", "p")).rejects.toThrow("Key generation failed");
    });
  });

  describe("encryptText", () => {
    it("retorna armored ciphertext", async () => {
      mockReadKey.mockResolvedValue({ id: "key" });
      mockCreateMessage.mockResolvedValue({ id: "msg" });
      mockEncrypt.mockResolvedValue("-----BEGIN PGP MESSAGE-----\n...");
      const r = await encryptText("hello", "ARMORED_PUBKEY");
      expect(r).toContain("PGP MESSAGE");
      expect(mockReadKey).toHaveBeenCalledWith({ armoredKey: "ARMORED_PUBKEY" });
      expect(mockCreateMessage).toHaveBeenCalledWith({ text: "hello" });
    });

    it("throw 'Text encryption failed' cuando readKey falla", async () => {
      mockReadKey.mockRejectedValue(new Error("invalid key"));
      await expect(encryptText("hi", "BAD")).rejects.toThrow("Text encryption failed");
    });
  });

  describe("decryptText", () => {
    it("happy path: retorna plaintext", async () => {
      mockReadPrivateKey.mockResolvedValue({ id: "priv" });
      mockDecryptKey.mockResolvedValue({ id: "unlocked" });
      mockReadMessage.mockResolvedValue({ id: "msg" });
      mockDecrypt.mockResolvedValue({ data: "hola decryptado" });
      const r = await decryptText("CIPHER", "PRIV", "passphrase");
      expect(r).toBe("hola decryptado");
    });

    it("throw 'check passphrase' cuando decryptKey falla (passphrase incorrecto)", async () => {
      mockReadPrivateKey.mockResolvedValue({ id: "priv" });
      mockDecryptKey.mockRejectedValue(new Error("incorrect passphrase"));
      await expect(decryptText("CIPHER", "PRIV", "wrong")).rejects.toThrow(/check passphrase/);
    });

    it("throw cuando el ciphertext es inválido", async () => {
      mockReadPrivateKey.mockResolvedValue({ id: "priv" });
      mockDecryptKey.mockResolvedValue({ id: "unlocked" });
      mockReadMessage.mockRejectedValue(new Error("invalid armor"));
      await expect(decryptText("BAD", "PRIV", "p")).rejects.toThrow(/decryption failed/);
    });
  });

  describe("encryptBytes / decryptBytes (binary)", () => {
    it("encryptBytes pasa format: 'binary' a openpgp.encrypt", async () => {
      mockReadKey.mockResolvedValue({ id: "key" });
      mockCreateMessage.mockResolvedValue({ id: "msg" });
      const fakeOut = new Uint8Array([1, 2, 3]);
      mockEncrypt.mockResolvedValue(fakeOut);
      const r = await encryptBytes(new Uint8Array([42]), "PUB");
      expect(r).toBe(fakeOut);
      expect(mockEncrypt).toHaveBeenCalledWith(expect.objectContaining({ format: "binary" }));
      expect(mockCreateMessage).toHaveBeenCalledWith({ binary: expect.any(Uint8Array) });
    });

    it("decryptBytes happy path retorna Uint8Array", async () => {
      mockReadPrivateKey.mockResolvedValue({ id: "priv" });
      mockDecryptKey.mockResolvedValue({ id: "unlocked" });
      mockReadMessage.mockResolvedValue({ id: "msg" });
      const fakeData = new Uint8Array([9, 8, 7]);
      mockDecrypt.mockResolvedValue({ data: fakeData });
      const r = await decryptBytes(new Uint8Array([1]), "PRIV", "p");
      expect(r).toBe(fakeData);
    });

    it("encryptBytes throw 'Binary encryption failed' al fallar", async () => {
      mockReadKey.mockRejectedValue(new Error("bad key"));
      await expect(encryptBytes(new Uint8Array(), "PUB")).rejects.toThrow("Binary encryption failed");
    });

    it("decryptBytes throw 'check passphrase' al fallar decrypt", async () => {
      mockReadPrivateKey.mockResolvedValue({ id: "priv" });
      mockDecryptKey.mockRejectedValue(new Error("wrong pass"));
      await expect(decryptBytes(new Uint8Array(), "PRIV", "bad")).rejects.toThrow(/check passphrase/);
    });
  });

  describe("verifyPublicKey", () => {
    it("true cuando openpgp acepta la key", async () => {
      mockReadKey.mockResolvedValue({ id: "valid" });
      expect(await verifyPublicKey("VALID_PUB")).toBe(true);
    });

    it("false cuando openpgp rechaza la key (graceful)", async () => {
      mockReadKey.mockRejectedValue(new Error("invalid armor"));
      expect(await verifyPublicKey("INVALID")).toBe(false);
    });

    it("nunca throw — siempre retorna boolean", async () => {
      mockReadKey.mockRejectedValue(new Error("anything"));
      await expect(verifyPublicKey("")).resolves.toBe(false);
    });
  });

  describe("extractEmailFromKey", () => {
    it("extrae email del primer userID con formato 'Name <email@x>'", async () => {
      mockReadKey.mockResolvedValue({
        getUserIDs: () => ["Alice Cipher <alice@example.com>"],
      });
      expect(await extractEmailFromKey("PUB")).toBe("alice@example.com");
    });

    it("retorna null cuando userId no tiene email entre <...>", async () => {
      mockReadKey.mockResolvedValue({
        getUserIDs: () => ["Just a Name"],
      });
      expect(await extractEmailFromKey("PUB")).toBeNull();
    });

    it("retorna null cuando getUserIDs() retorna vacío", async () => {
      mockReadKey.mockResolvedValue({ getUserIDs: () => [] });
      expect(await extractEmailFromKey("PUB")).toBeNull();
    });

    it("retorna null cuando openpgp rechaza la key", async () => {
      mockReadKey.mockRejectedValue(new Error("invalid"));
      expect(await extractEmailFromKey("BAD")).toBeNull();
    });

    it("retorna el primer email cuando hay múltiples userIDs", async () => {
      mockReadKey.mockResolvedValue({
        getUserIDs: () => ["First <first@x.com>", "Second <second@x.com>"],
      });
      expect(await extractEmailFromKey("PUB")).toBe("first@x.com");
    });
  });
});
