import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { AuthService } from 'src/app/auth.service';
import { HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.scss']
})
export class LoginPageComponent implements OnInit {

  loginForm = new FormGroup({
    email: new FormControl('', [
      Validators.required,
      Validators.minLength(4),
      Validators.pattern('^([a-zA-Z0-9_.-]+)@([a-zA-Z0-9_.-]+)\\.([a-zA-Z]{2,5})$')
    ]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(8)
    ])
  });

  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }

  @ViewChild('alertContainer') alertContainer: ElementRef;


  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit() {
    const id = this.authService.getUserId();
    const accessToken = this.authService.getAccessToken();

    if (!id && !accessToken) return;

    this.router.navigateByUrl('/lists');
  }

  onLoginButtonClicked(email: string, password: string) {
    this.authService.login(email, password).subscribe(
      (res: HttpResponse<any>) => {
        if (res.status === 200) {
          // we have logged in successfully
          this.router.navigate(['/lists']);
        }
      },
      (err) => {
        console.log('err from login', err);
        this.loginErrorFeedback();
      });
  }

  private loginErrorFeedback() {
    const config = {
      target: this.alertContainer.nativeElement,
      icon: 'error',
      title: 'Authentication Error!',
      text: 'Email/Password not found. Please verify your credentials and try again'
    };

    // show popup
    this.sweetAlert(config);
    console.log('something happend?');
  }

  private sweetAlert(config) {
    Swal.fire(config);
  }

}
