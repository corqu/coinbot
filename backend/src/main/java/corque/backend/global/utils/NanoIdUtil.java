package corque.backend.global.utils;

import com.aventrix.jnanoid.jnanoid.NanoIdUtils;

import java.security.SecureRandom;

public class NanoIdUtil {

    private static final SecureRandom RANDOM = new SecureRandom();

    private static final char[] ALPHABET = "123456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ".toCharArray();

    public static String generateNanoId(int size) {
        return NanoIdUtils.randomNanoId(RANDOM, ALPHABET, size);
    }
}
