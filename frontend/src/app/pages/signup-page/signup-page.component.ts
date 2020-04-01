import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  ChangeDetectorRef
} from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { AuthService } from 'src/app/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, FormBuilder, Validators } from '@angular/forms';

// ES6 Modules or TypeScript
import Swal from 'sweetalert2';


@Component({
  selector: 'app-signup-page',
  templateUrl: './signup-page.component.html',
  styleUrls: ['./signup-page.component.scss']
})

export class SignupPageComponent implements OnInit {
  captchaRequired: boolean;
  private sitekey = '6Lf1C-UUAAAAAGrMhNWuQ06RCX--x5g0ZbJ36DBd';
  private captchaResponse = null;

  signupForm = new FormGroup({
    name: new FormControl('', [
      Validators.required,
      Validators.minLength(3)
    ]),
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

  get name() { return this.signupForm.get('name'); }
  get email() { return this.signupForm.get('email'); }
  get password() { return this.signupForm.get('password'); }

  @ViewChild('container') container: ElementRef;
  @ViewChild('grecaptchaElement') grecaptchaElement: ElementRef;

  constructor(
    private authService: AuthService,
    private router: Router,
    private changeDetector: ChangeDetectorRef,
    private fb: FormBuilder
  ) { }


  ngOnInit() {
    const id = this.authService.getUserId();
    const accessToken = this.authService.getAccessToken();

    if (!id && !accessToken) return;

    this.router.navigateByUrl('/lists');
  }

  onSignupButtonClicked(name: string, email: string, password: string) {
    // console.log('email', [email, password]);
    this.authService.signup(name, email, password, this.captchaResponse).subscribe(
      (res: any) => {
        const body = res.body;
        // if a user is returned redirect to lists
        if (body._id && body.email) {
          this.router.navigate(['/lists']);
        }
      },
      e => {
        console.log('error from signup page', e);

        // captcha error
        if (e.error.captcha) {
          this.captchaRequired = true;
          this.captchaErrorFeedback();
        }

        // mongo error
        if (e.error.name === "MongoError") {
          this.saveErrorFeedback();
        }
      }
    );
  }

  // adds the script to generate Google ReCaptcha
  private addRecaptchaScript() {
    window['grecaptchaCallback'] = () => { this.renderReCaptcha(); };

    (function (doc, s, id, obj) {
      let js, fjs;

      js = fjs = doc.getElementsByTagName(s)[0];
      if (doc.getElementById(id)) {
        return;
      }
      js = doc.createElement(s);
      js.id = id;
      js.src =
        'https://www.google.com/recaptcha/api.js?onload=grecaptchaCallback&amp;render=explicit';
      fjs.parentNode.insertBefore(js, fjs);
    })(document, 'script', 'recaptcha-jssdk', this);
  }

  // actually renders the Google ReCaptcha
  private renderReCaptcha() {
    window['grecaptcha'].render(this.grecaptchaElement.nativeElement, {
      sitekey: this.sitekey,
      callback: (response) => {
        console.log(response);
        this.captchaResponse = response;
      }
    });
  }


  private captchaErrorFeedback() {
    this.changeDetector.detectChanges();
    this.addRecaptchaScript();

    const config = {
      target: this.container.nativeElement,
      icon: 'error',
      title: 'You have tried too many times!',
      text: 'Please verify with captcha and try again'
    };

    // show popup
    this.sweetAlert(config);


  }

  private saveErrorFeedback() {
    const config = {
      target: this.container.nativeElement,
      icon: 'error',
      title: 'This account already exists!',
      text: 'Enter a different email and try again',
      footer: '<a routerLink="/login">Login Instead</a>'
    };

    // show popup
    this.sweetAlert(config);


  }

  private sweetAlert(config) {
    Swal.fire(config);
  }
}
