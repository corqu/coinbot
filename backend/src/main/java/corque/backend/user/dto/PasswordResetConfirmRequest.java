package corque.backend.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class PasswordResetConfirmRequest {

    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String code;

    @NotBlank
    @Size(min = 8)
    private String newPassword;
}
