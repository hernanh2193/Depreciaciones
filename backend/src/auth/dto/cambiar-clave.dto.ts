import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

export class CambiarClaveDto {
  @IsString()
  @IsNotEmpty({ message: 'Debe ingresar su usuario' })
  @MaxLength(30)
  usuario: string;

  @IsString()
  @IsNotEmpty({ message: 'Debe ingresar su clave actual' })
  @MaxLength(30)
  claveActual: string;

  // DEP_USUARIOS.USU_PASSWORD es VARCHAR2(20)
  @IsString()
  @Length(8, 20, { message: 'La nueva clave debe tener entre 8 y 20 caracteres' })
  claveNueva: string;
}
